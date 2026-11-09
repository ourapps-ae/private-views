import ae.views.ViewEnvelope
import ae.views.isNewer
import ae.views.isOwn
import ae.views.matchesMode

data class TestView(override val version: Int, override val roomId: String, override val you: String = "", override val display: Boolean = false) : ViewEnvelope

// The cases of tests/fixtures/views.json, written out so no JSON library is needed.
fun main() {
    check(isNewer(TestView(1, "a"), null))
    check(isNewer(TestView(5, "a"), TestView(4, "a")))
    check(!isNewer(TestView(4, "a"), TestView(4, "a")))
    check(!isNewer(TestView(3, "a"), TestView(4, "a")))
    check(isNewer(TestView(1, "b"), TestView(9, "a")))
    check(matchesMode(TestView(1, "a", display = false), false) && !matchesMode(TestView(1, "a", display = false), true))
    check(matchesMode(TestView(1, "a", display = true), true) && !matchesMode(TestView(1, "a", display = true), false))
    check(isOwn(TestView(1, "a", "p1"), "p1"))
    check(!isOwn(TestView(1, "a", ""), ""))
    println("view assertions passed")
}
