/**
 * E2E type-test file for INVALID inputs — vue-tsc should produce errors on every line marked @err.
 * The unit test runs vue-tsc and asserts that each expected error is reported.
 */
import { defineOgImage } from '#imports'

// @err: invalid component name
defineOgImage('DoesNotExist', {})

// @err: wrong prop type (title should be string, not number)
defineOgImage('CustomFonts', { title: 123 })

// @err: invalid colorMode value (should be 'dark' | 'light')
defineOgImage('CustomFonts', { colorMode: 'blue' })
