import Foundation

func check(_ condition: Bool, _ message: String) {
    if !condition { FileHandle.standardError.write(Data("FAILED: \(message)\n".utf8)); exit(1) }
}

struct TestView: ViewEnvelope {
    let version: Int
    let roomId: String
    let you: String
    var display: Bool? = nil
}

let fixture = try JSONSerialization.jsonObject(with: Data(contentsOf: URL(fileURLWithPath: "tests/fixtures/views.json"))) as! [String: Any]
var count = 0
for c in fixture["cases"] as! [[String: Any]] {
    let i = c["incoming"] as! [String: Any]
    let incoming = TestView(version: i["version"] as! Int, roomId: i["roomId"] as! String, you: "")
    var current: TestView? = nil
    if let k = c["current"] as? [String: Any] { current = TestView(version: k["version"] as! Int, roomId: k["roomId"] as! String, you: "") }
    check(PrivateViews.isNewer(incoming, than: current) == (c["newer"] as! Bool), c["name"] as! String)
    count += 1
}
for m in fixture["modes"] as! [[String: Any]] {
    let view = TestView(version: 1, roomId: "a", you: "", display: m["display"] as? Bool)
    check(PrivateViews.matchesMode(view, display: false) == (m["player"] as! Bool), "player mode \(m)")
    check(PrivateViews.matchesMode(view, display: true) == (m["displayMode"] as! Bool), "display mode \(m)")
    count += 2
}
check(TestView(version: 1, roomId: "a", you: "p1").isDisplay == false, "absent display flag is false")
check(PrivateViews.isOwn(TestView(version: 1, roomId: "a", you: "p1"), id: "p1"), "own view")
check(!PrivateViews.isOwn(TestView(version: 1, roomId: "a", you: ""), id: ""), "a display owns nothing")
print("\(count + 3) view assertions passed")
