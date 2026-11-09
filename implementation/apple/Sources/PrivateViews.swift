import Foundation

// What every view of a room carries (the server's private-views component sets these).
protocol ViewEnvelope {
    var version: Int { get }
    var roomId: String { get }
    // Your id; "" for a display (a public screen).
    var you: String { get }
    var display: Bool? { get }
}

extension ViewEnvelope {
    var isDisplay: Bool { display ?? false }
}

enum PrivateViews {
    // A view only replaces one from the same room with a lower version: an action's reply and the
    // pushed view can arrive in either order.
    static func isNewer<V: ViewEnvelope>(_ incoming: V, than current: V?) -> Bool {
        guard let current, current.roomId == incoming.roomId else { return true }
        return incoming.version > current.version
    }

    // A player's connection must only be given player views, a display's only public ones.
    static func matchesMode<V: ViewEnvelope>(_ view: V, display: Bool) -> Bool { view.isDisplay == display }

    static func isOwn<V: ViewEnvelope>(_ view: V, id: String) -> Bool { !view.you.isEmpty && view.you == id }
}
