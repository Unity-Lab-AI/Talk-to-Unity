/**
 * Test script to verify regex patterns in speech processing functions
 * Run with: node test_regex_patterns.js
 */

// Test cases for removeCommandArtifacts
const removeCommandArtifacts_tests = [
    {
        input: 'Here is the result \\\\[command:open_image\\\\] and more text', // Double backslash for literal \
        expected: 'Here is the result   and more text',
        description: 'Should remove escaped bracket commands with literal backslashes'
    },
    {
        input: 'Execute (command: foo) and continue',
        expected: 'Execute   and continue',
        description: 'Should remove parenthesis commands'
    },
    {
        input: 'Some text <command:bar> more text',
        expected: 'Some text   more text',
        description: 'Should remove angle bracket commands'
    },
    {
        input: 'Please command: generate_image and continue',
        expected: 'Please   and continue',
        description: 'Should remove command assignments'
    },
    {
        input: 'execute command foo',
        expected: '  ',
        description: 'Should remove execute command patterns'
    }
];

// Test cases for sanitizeForSpeech
const sanitizeForSpeech_tests = [
    {
        input: 'Check out this image: https://image.pollinations.ai/prompt/test.png',
        expected_contains_not: 'pollinations',
        description: 'Should remove Pollinations URLs'
    },
    {
        input: 'Visit https://example.com for more info',
        expected_contains_not: 'https',
        description: 'Should remove regular URLs'
    },
    {
        input: 'Here is a command: do_something',
        expected_contains_not: 'command',
        description: 'Should remove command directives'
    },
    {
        input: 'Normal text to speak',
        expected: 'Normal text to speak',
        description: 'Should preserve normal text'
    },
    {
        input: 'h t t p s : / / example . com',
        expected_contains_not: 'example',
        description: 'Should remove spaced out URLs'
    }
];

// Copy the functions from app.js
function removeCommandArtifacts(value) {
    if (typeof value !== 'string') {
        return '';
    }

    let result = value
        .replace(/\\\[[^\\]]*\bcommand\b[^\\]*\]/gi, ' ')
        .replace(/\([^)]*\bcommand\b[^)]*\)/gi, ' ')
        .replace(/<[^>]*\bcommand\b[^>]*>/gi, ' ')
        .replace(/\bcommands?\s*[:=-]\s*[a-z0-9_\s,-]+/gi, ' ')
        .replace(/\bactions?\s*[:=-]\s*[a-z0-9_\s,-]+/gi, ' ')
        .replace(/\b(?:execute|run)\s+command\s*(?:[:=-]\s*)?[a-z0-9_-]*/gi, ' ')
        .replace(/\bcommand\s*(?:[:=-]\s*|\s+)(?:[a-z0-9_-]+(?:\s+[a-z0-9_-]+)*)?/gi, ' ');

    result = result.replace(/^\s*[-*]?\s*(?:command|action)[^\n]*$/gim, ' ');

    return result;
}

function isLikelyUrlSegment(part) {
    if (!part || part.trim().length === 0) {
        return false;
    }

    const urlIndicators = [
        /(?:https?|www|:\/\/|\.com|\.net|\.org|\.io|\.ai|\.co|\.gov|\.edu)/i,
        /^[\w-]+\.[\w-]+$/,
        /[\w-]+\.(?:com|net|org|io|ai|co|gov|edu|png|jpg|jpeg|gif)$/i
    ];

    return urlIndicators.some((pattern) => pattern.test(part));
}

function removeMarkdownLinkTargets(text) {
    return text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
}

function sanitizeForSpeech(text) {
    if (typeof text !== 'string') {
        return '';
    }

    const withoutDirectives = text
        .replace(/\\\[command:[^\\]*\]/gi, ' ')
        .replace(/\{\{command:[^}]*\}\}/gi, ' ')
        .replace(/<command[^>]*>[^<]*<\/command>/gi, ' ')
        .replace(/\b(?:command|action)\s*[:=]\s*([a-z0-9_\-]+)/gi, ' ')
        .replace(/\bcommands?\s*[:=]\s*([a-z0-9_\-]+)/gi, ' ')
        .replace(/\b(?:command|action)\s*(?:->|=>|::)\s*([a-z0-9_\-]+)/gi, ' ')
        .replace(/\b(?:command|action)\b\s*[()\-:=]*\s*[a-z0-9_\-]+/gi, ' ')
        .replace(/\bcommand\s*\([^)]*\)/gi, ' ');

    const withoutPollinations = withoutDirectives
        .replace(/https?:\/\/\S*images?\s*\.pollinations\.ai\S*/gi, '')
        .replace(/\b\S*images?\s*\.pollinations\.ai\S*\b/gi, '');

    const withoutMarkdownTargets = removeMarkdownLinkTargets(withoutPollinations);
    const withoutCommands = removeCommandArtifacts(withoutMarkdownTargets);

    const withoutGenericUrls = withoutCommands
        .replace(/https?:\/\/\S+/gi, ' ')
        .replace(/\bwww\.[^\s)]+/gi, ' ');

    const withoutSpacedUrls = withoutGenericUrls
        .replace(/h\s*t\s*t\s*p\s*s?\s*:\s*\/\s*\/\s*[\w\-.\n/?%#&=]+/gi, ' ')
        .replace(/\bhttps?\b/gi, ' ')
        .replace(/\bwww\b/gi, ' ');

    const withoutSpelledUrls = withoutSpacedUrls
        .replace(/h\s*t\s*t\s*p\s*s?\s*(?:[:=]|colon)\s*\/\s*\/\s*[\w\-.\n/?%#&=]+/gi, ' ')
        .replace(/\b(?:h\s*t\s*t\s*p\s*s?|h\s*t\s*t\s*p)\b/gi, ' ')
        .replace(/\bcolon\b/gi, ' ')
        .replace(/\bslash\b/gi, ' ');

    const parts = withoutSpelledUrls.split(/(\s+)/);
    const sanitizedParts = parts.map((part) => {
        if (isLikelyUrlSegment(part)) {
            return '';
        }

        if (/(?:https?|www|:\/\/|\.com|\.net|\.org|\.io|\.ai|\.co|\.gov|\.edu)/i.test(part)) {
            return '';
        }

        if (/\bcommand\b/i.test(part)) {
            return '';
        }

        if (/(?:image|artwork|photo)\s+(?:url|link)/i.test(part)) {
            return '';
        }

        return part;
    });

    const commandTokens = ['open_image', 'show_image', 'display_image', 'image_url'];
    const cleaned = sanitizedParts
        .join('')
        .split(/\s+/)
        .filter((word) => !commandTokens.includes(word.toLowerCase()))
        .join(' ')
        .trim();

    return cleaned.replace(/\s{2,}/g, ' ');
}

// Run tests
console.log('=== Testing removeCommandArtifacts ===\n');
let passed = 0;
let failed = 0;

removeCommandArtifacts_tests.forEach((test, index) => {
    try {
        const result = removeCommandArtifacts(test.input);
        const success = result.replace(/\s+/g, ' ').trim() === test.expected.replace(/\s+/g, ' ').trim();

        if (success) {
            console.log(`✓ Test ${index + 1}: ${test.description}`);
            passed++;
        } else {
            console.log(`✗ Test ${index + 1}: ${test.description}`);
            console.log(`  Input:    "${test.input}"`);
            console.log(`  Expected: "${test.expected}"`);
            console.log(`  Got:      "${result}"`);
            failed++;
        }
    } catch (error) {
        console.log(`✗ Test ${index + 1}: ${test.description}`);
        console.log(`  ERROR: ${error.message}`);
        failed++;
    }
});

console.log('\n=== Testing sanitizeForSpeech ===\n');

sanitizeForSpeech_tests.forEach((test, index) => {
    try {
        const result = sanitizeForSpeech(test.input);
        let success;

        if (test.expected) {
            success = result.trim() === test.expected.trim();
        } else if (test.expected_contains_not) {
            success = !result.toLowerCase().includes(test.expected_contains_not.toLowerCase());
        }

        if (success) {
            console.log(`✓ Test ${index + 1}: ${test.description}`);
            passed++;
        } else {
            console.log(`✗ Test ${index + 1}: ${test.description}`);
            console.log(`  Input:    "${test.input}"`);
            if (test.expected) {
                console.log(`  Expected: "${test.expected}"`);
            } else {
                console.log(`  Should not contain: "${test.expected_contains_not}"`);
            }
            console.log(`  Got:      "${result}"`);
            failed++;
        }
    } catch (error) {
        console.log(`✗ Test ${index + 1}: ${test.description}`);
        console.log(`  ERROR: ${error.message}`);
        failed++;
    }
});

console.log(`\n=== Results ===`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Total:  ${passed + failed}`);

process.exit(failed > 0 ? 1 : 0);
