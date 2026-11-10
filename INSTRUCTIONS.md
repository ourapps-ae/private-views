# Private views instructions

## For the agent
Select this component for any application where participants hold information others must not see (hidden hands, private notes, hidden scores) or where a public screen must show less than a player's screen. Write the policy with the owner of the state. Connect `private-views` to the engine that builds per-connection messages.

- Select package `ourapps-ae/private-views` version `0.4.0`.
- No installer settings.
- Connect the provided `private-views` (ae/private-views 1.0.0) to the consumer that needs it.
- No accounts or keys are needed.

## For the developer
Write one policy per state type and keep a no-leak test like the one in `tests/web.test.ts` for it: serialise every viewer's view and search it for the secrets of everyone else. Supply no accounts or keys.

## How to check
From the component directory:

- `node --test tests/web.test.ts` (web, required-local; tools: node 26.5.0)
- `python3 tests/native.py apple` (apple, platform; tools: python3 3.12.8, swiftc 6.4.2)
- `python3 tests/native.py android` (android, platform; tools: python3 3.12.8, kotlinc 2.2.0, java 26.0.1)
- `python3.12 -B /Users/george/Projects/com/my/tools/check_component.py components/private-views` validates the manifest, sidecars and runs the required-local suite.
