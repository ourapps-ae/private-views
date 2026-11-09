package ae.views

// What every view of a room carries (the server's private-views component sets these).
interface ViewEnvelope {
    val version: Int
    val roomId: String
    // Your id; "" for a display (a public screen).
    val you: String
    val display: Boolean
}

// A view only replaces one from the same room with a lower version: an action's reply and the
// pushed view can arrive in either order.
fun isNewer(incoming: ViewEnvelope, current: ViewEnvelope?): Boolean =
    current == null || current.roomId != incoming.roomId || incoming.version > current.version

// A player's connection must only be given player views, a display's only public ones.
fun matchesMode(view: ViewEnvelope, display: Boolean): Boolean = view.display == display

fun isOwn(view: ViewEnvelope, id: String): Boolean = view.you.isNotEmpty() && view.you == id
