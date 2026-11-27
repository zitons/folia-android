import Capacitor
import Foundation

@objc(FoliaSourceHTTP)
final class FoliaSourceHTTP: CAPPlugin, CAPBridgedPlugin {
    let identifier = "FoliaSourceHTTP"
    let jsName = "FoliaNative"
    let pluginMethods = [
        CAPPluginMethod(name: "httpRequest", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cookiesGetBatch", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cookiesSet", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cookiesRemove", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cookiesRemoveBatch", returnType: CAPPluginReturnPromise),
    ]

    private static let hosts = [
        "music.163.com", "126.net", "qq.com", "gtimg.cn", "qlogo.cn",
        "tencentmusic.com", "kugou.com", "kgimg.com", "kuwo.cn", "api.qrserver.com",
        "github.com", "api.github.com", "gh-proxy.org",
    ]
    private let cookies = HTTPCookieStorage.shared

    fileprivate static func isAllowedHost(_ host: String) -> Bool {
        hosts.contains { host == $0 || host.hasSuffix("." + $0) }
    }

    fileprivate static func secureURL(_ raw: String) -> URL? {
        guard var parsed = URLComponents(string: raw),
              let host = parsed.host?.lowercased(),
              isAllowedHost(host),
              parsed.user == nil, parsed.password == nil else { return nil }
        if parsed.scheme?.lowercased() == "http", parsed.port == nil {
            parsed.scheme = "https"
        }
        guard parsed.scheme?.lowercased() == "https", parsed.port == nil || parsed.port == 443 else { return nil }
        return parsed.url
    }

    @objc func httpRequest(_ call: CAPPluginCall) {
        guard let url = Self.secureURL(call.getString("url") ?? "") else {
            call.reject("The request destination is unavailable in the iOS music bridge")
            return
        }
        let method = (call.getString("method") ?? "GET").uppercased()
        guard ["GET", "POST", "HEAD", "PUT", "PATCH", "DELETE", "OPTIONS"].contains(method) else {
            call.reject("Unsupported request method")
            return
        }
        let timeout = Double(min(max(call.getInt("timeoutMs") ?? 15_000, 1), 120_000)) / 1_000
        var request = URLRequest(url: url, timeoutInterval: timeout)
        request.httpMethod = method
        for (name, value) in call.getObject("headers") ?? [:] {
            if ["host", "content-length", "transfer-encoding", "connection"].contains(name.lowercased()) { continue }
            if let text = value as? String {
                request.setValue(text, forHTTPHeaderField: name)
            }
        }
        if method != "GET" && method != "HEAD" {
            if let encoded = call.getString("bodyBase64"), !encoded.isEmpty {
                guard let body = Data(base64Encoded: encoded) else {
                    call.reject("Invalid request body")
                    return
                }
                request.httpBody = body
            } else if let body = call.getString("bodyText"), !body.isEmpty {
                request.httpBody = Data(body.utf8)
            }
        }

        let configuration = URLSessionConfiguration.ephemeral
        configuration.timeoutIntervalForResource = timeout
        configuration.urlCache = nil
        let sendCookies = call.getBool("sendCookies") ?? true
        configuration.httpCookieStorage = sendCookies ? cookies : nil
        configuration.httpShouldSetCookies = sendCookies
        let redirects = SourceRedirectPolicy(mode: call.getString("redirect") ?? "follow")
        let session = URLSession(configuration: configuration, delegate: redirects, delegateQueue: nil)
        session.dataTask(with: request) { data, response, error in
            defer { session.finishTasksAndInvalidate() }
            guard error == nil, let response = response as? HTTPURLResponse else {
                call.reject("The music service request failed")
                return
            }
            if redirects.mode == "error", (300..<400).contains(response.statusCode),
               response.value(forHTTPHeaderField: "Location") != nil {
                call.reject("The music service redirected the request")
                return
            }
            let headers = response.allHeaderFields.compactMap { name, value -> [String: String]? in
                guard let name = name as? String else { return nil }
                return ["name": name, "value": String(describing: value)]
            }
            call.resolve([
                "status": response.statusCode,
                "headers": headers,
                "bodyBase64": (data ?? Data()).base64EncodedString(),
            ])
        }.resume()
    }

    private func matchingCookies(url: String, domain: String) -> [HTTPCookie] {
        if !url.isEmpty {
            guard let url = Self.secureURL(url) else { return [] }
            return cookies.cookies(for: url) ?? []
        }
        let domain = domain.trimmingCharacters(in: CharacterSet(charactersIn: ".")).lowercased()
        guard Self.isAllowedHost(domain) else { return [] }
        return (cookies.cookies ?? []).filter { cookie in
            let host = cookie.domain.trimmingCharacters(in: CharacterSet(charactersIn: ".")).lowercased()
            return host == domain || host.hasSuffix("." + domain)
        }
    }

    @objc func cookiesGetBatch(_ call: CAPPluginCall) {
        let targets = call.getArray("targets") ?? []
        let results = targets.map { value -> [[String: Any]] in
            guard let target = value as? JSObject else { return [] }
            return matchingCookies(
                url: target["url"] as? String ?? "",
                domain: target["domain"] as? String ?? ""
            ).map { cookie in
                ["name": cookie.name, "value": cookie.value, "domain": cookie.domain, "path": cookie.path]
            }
        }
        call.resolve(["results": results])
    }

    @objc func cookiesSet(_ call: CAPPluginCall) {
        guard let url = Self.secureURL(call.getString("url") ?? ""),
              let host = url.host,
              let name = call.getString("name"), !name.isEmpty,
              let value = call.getString("value") else {
            call.resolve(["ok": false])
            return
        }
        let domain = call.getString("domain") ?? host
        let canonical = domain.trimmingCharacters(in: CharacterSet(charactersIn: ".")).lowercased()
        guard Self.isAllowedHost(canonical), host == canonical || host.hasSuffix("." + canonical) else {
            call.resolve(["ok": false])
            return
        }
        var properties: [HTTPCookiePropertyKey: Any] = [
            .originURL: url, .domain: domain, .name: name, .value: value,
            .path: call.getString("path") ?? "/",
        ]
        if let expiration = call.getDouble("expirationDate"), expiration.isFinite {
            properties[.expires] = Date(timeIntervalSince1970: expiration)
        }
        if call.getBool("secure") ?? true { properties[.secure] = "TRUE" }
        guard let cookie = HTTPCookie(properties: properties) else {
            call.resolve(["ok": false])
            return
        }
        cookies.setCookie(cookie)
        call.resolve(["ok": true])
    }

    private func removeCookie(url: String, name: String) -> Int {
        let matching = matchingCookies(url: url, domain: "").filter { $0.name == name }
        matching.forEach { cookies.deleteCookie($0) }
        return matching.count
    }

    @objc func cookiesRemove(_ call: CAPPluginCall) {
        let removed = removeCookie(url: call.getString("url") ?? "", name: call.getString("name") ?? "")
        call.resolve(["ok": removed > 0])
    }

    @objc func cookiesRemoveBatch(_ call: CAPPluginCall) {
        let removed = (call.getArray("entries") ?? []).reduce(0) { count, value in
            guard let entry = value as? JSObject else { return count }
            return count + removeCookie(url: entry["url"] as? String ?? "", name: entry["name"] as? String ?? "")
        }
        call.resolve(["ok": true, "removed": removed])
    }
}

private final class SourceRedirectPolicy: NSObject, URLSessionTaskDelegate {
    let mode: String

    init(mode: String) {
        self.mode = mode
    }

    func urlSession(
        _ session: URLSession,
        task: URLSessionTask,
        willPerformHTTPRedirection response: HTTPURLResponse,
        newRequest request: URLRequest,
        completionHandler: @escaping (URLRequest?) -> Void
    ) {
        guard mode == "follow", let url = request.url,
              FoliaSourceHTTP.secureURL(url.absoluteString) == url else {
            completionHandler(nil)
            return
        }
        var forwarded = request
        if response.url?.host != url.host {
            forwarded.setValue(nil, forHTTPHeaderField: "Authorization")
            forwarded.setValue(nil, forHTTPHeaderField: "Cookie")
        }
        completionHandler(forwarded)
    }
}
