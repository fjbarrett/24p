## What changed and why

<!-- One paragraph. Focus on the motivation, not a restatement of the diff. -->

## Dev verification

The deploy to dev runs automatically on this PR. Before merging:

- [ ] Checked https://24p-dev.actual.company and the change works as expected
- [ ] Checked that nothing obviously unrelated is broken (auth, list loading, movie detail)
- [ ] If this touches auth or env config — verified sign-in works on dev
- [ ] If this touches public routes — verified behaviour in an incognito window
