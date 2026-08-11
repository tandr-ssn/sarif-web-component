import {markdownToPlainText} from './MarkdownText'

test('converts formatted Markdown to readable plain text', () => {
	expect(markdownToPlainText(`
### Remediation

Upgrade **Calgary.Package** and see [the advisory](https://example.test/advisory).

1. Run \`npm update\`.
2. Restart the River service.

> Verify the resolved version.
`)).toBe(
		'Remediation\n\n' +
		'Upgrade Calgary.Package and see the advisory (https://example.test/advisory).\n\n' +
		'1. Run npm update.\n2. Restart the River service.\n\n' +
		'> Verify the resolved version.')
})

test('converts GFM tables to aligned text without the Markdown separator row', () => {
	expect(markdownToPlainText(`
| Version | Status   |
| ------- | -------- |
| 1.0     | affected |
| 2.0     | fixed    |
`)).toBe(
		'Version | Status\n' +
		'1.0     | affected\n' +
		'2.0     | fixed')
})

test('retains fenced code content and task-list state', () => {
	expect(markdownToPlainText('- [x] Reviewed\n- [ ] Deploy\n\n```sh\nnpm update\n```'))
		.toBe('- [x] Reviewed\n- [ ] Deploy\n\nnpm update')
})
