// Debug regex pattern matching

console.log('=== Test 1: Escaped brackets ===');
const input1 = 'Here is the result \\[command:open_image\\] and more text';
const pattern1 = /\\\[[^\\]*\bcommand\b[^\\]*\]/gi;

console.log('Input:', JSON.stringify(input1));
console.log('Input characters:', [...input1].map((c, i) => `${i}:${c}(${c.charCodeAt(0)})`).join(' '));
console.log('Pattern:', pattern1);
console.log('Match:', input1.match(pattern1));
console.log('After replace:', input1.replace(pattern1, ' XXX '));

console.log('\n=== Test 4: Command assignment ===');
const input4 = 'Please command: generate_image and continue';
const pattern4 = /\bcommand\s*(?:[:=-]\s*|\s+)(?:[a-z0-9_-]+(?:\s+[a-z0-9_-]+)*)?/gi;

console.log('Input:', JSON.stringify(input4));
console.log('Pattern:', pattern4);
console.log('Match:', input4.match(pattern4));
console.log('After replace:', input4.replace(pattern4, ' '));
