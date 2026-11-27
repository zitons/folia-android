import UIKit
import Capacitor
import AVFAudio

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
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback)
        } catch {
            NSLog("Folia could not configure the playback audio session: %@", error.localizedDescription)
        }
        bridge?.registerPluginInstance(FoliaSourceHTTP())
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
