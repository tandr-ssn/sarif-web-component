import {stableSha256} from './StableHash'

test('produces standard SHA-256 values for ASCII and Unicode input', () => {
	expect(stableSha256('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
	expect(stableSha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
	expect(stableSha256('Bow River 🌊')).toBe('ab39bc9c48e636be50e5f7338ed505fe9675b01db4dc7d60fa11223c6478a0ed')
})
