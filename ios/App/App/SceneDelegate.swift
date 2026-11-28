import UIKit
import Capacitor
import AVFAudio
import WebKit

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = SafeAreaViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}

private final class MusicBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        let controller = webView?.configuration.userContentController
        controller?.add(ThemeColorHandler(owner: self), name: "foliaSafeAreaColor")
        controller?.addUserScript(WKUserScript(source: """
            (() => {
                let previous = '';
                let root;
                const styleObserver = new MutationObserver(() => update());
                const update = () => {
                    if (!root) return;
                    const color = getComputedStyle(root).getPropertyValue('--bg-color').trim();
                    if (!color || color === previous) return;
                    const probe = document.createElement('span');
                    probe.style.color = color;
                    if (!probe.style.color) return;
                    document.body.appendChild(probe);
                    const resolved = getComputedStyle(probe).color;
                    probe.remove();
                    const channels = resolved.match(/^rgba?\\(\\s*(\\d+(?:\\.\\d+)?)\\s*,\\s*(\\d+(?:\\.\\d+)?)\\s*,\\s*(\\d+(?:\\.\\d+)?)(?:\\s*,\\s*[\\d.]+)?\\s*\\)$/);
                    if (!channels) return;
                    previous = color;
                    window.webkit.messageHandlers.foliaSafeAreaColor.postMessage(channels.slice(1, 4).map(Number));
                };
                const discover = () => {
                    if (root && root.isConnected) return;
                    styleObserver.disconnect();
                    root = document.querySelector('[style*="--bg-color"]');
                    if (!root) return;
                    previous = '';
                    styleObserver.observe(root, { attributes: true, attributeFilter: ['style'] });
                    update();
                };
                new MutationObserver(discover).observe(document.documentElement, { childList: true, subtree: true });
                discover();
            })();
            """, injectionTime: .atDocumentEnd, forMainFrameOnly: true))
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback)
        } catch {
            NSLog("Folia could not configure the playback audio session: %@", error.localizedDescription)
        }
        bridge?.registerPluginInstance(FoliaSourceHTTP())
    }
}

private final class ThemeColorHandler: NSObject, WKScriptMessageHandler {
    private weak var owner: UIViewController?

    init(owner: UIViewController) {
        self.owner = owner
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let channels = message.body as? [Double], channels.count == 3,
              channels.allSatisfy({ $0.isFinite && (0...255).contains($0) }) else { return }
        owner?.parent?.view.backgroundColor = UIColor(
            red: channels[0] / 255, green: channels[1] / 255, blue: channels[2] / 255, alpha: 1
        )
    }
}

private final class SafeAreaViewController: UIViewController {
    private let bridgeController = MusicBridgeViewController()

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground

        // The web viewport itself stays inside UIKit's safe area. This covers fixed controls,
        // body portals and full-height pages together, including side insets after rotation.
        addChild(bridgeController)
        let bridgeView: UIView = bridgeController.view
        bridgeView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(bridgeView)
        let safeArea = view.safeAreaLayoutGuide
        NSLayoutConstraint.activate([
            bridgeView.topAnchor.constraint(equalTo: safeArea.topAnchor),
            bridgeView.leadingAnchor.constraint(equalTo: safeArea.leadingAnchor),
            bridgeView.trailingAnchor.constraint(equalTo: safeArea.trailingAnchor),
            bridgeView.bottomAnchor.constraint(equalTo: safeArea.bottomAnchor),
        ])
        bridgeController.didMove(toParent: self)
    }

    override var supportedInterfaceOrientations: UIInterfaceOrientationMask {
        bridgeController.isViewLoaded ? bridgeController.supportedInterfaceOrientations : super.supportedInterfaceOrientations
    }
}
