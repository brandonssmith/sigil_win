/**
 * Takes a string potentially containing inline numbered lists and formats them vertically.
 * Example input: "Here are the steps: 1. First step 2. Second step 3. Third step. This is the end."
 * Example output: "Here are the steps:\n1. First step\n2. Second step\n3. Third step.\nThis is the end."
 *
 * @param {string} text The input text.
 * @returns {string} The text with lists formatted vertically.
 */
export function formatListText(text) {
  if (!text) {
    return '';
  }

  // Regex to find potential list items: number, dot, space, then text until the next number-dot-space or end of string/paragraph.
  // It captures the number+dot+space and the item text separately.
  // It handles potential leading/trailing spaces around the item text.
  // It looks ahead ((?=\s\d+\.)|$) to stop before the *next* item or the end.
  const listItemRegex = /(\d+\.\s+)(.*?)(?=\s*\d+\.|\s*$)/g;

  let match;
  let lastIndex = 0;
  let result = '';
  let foundList = false;

  // Check if the text likely contains a list pattern "1. ... 2. ..."
  const containsListPattern = /\d+\.\s+.*?\s+\d+\./.test(text);

  if (!containsListPattern) {
    return text; // Return original text if no adjacent list items are found
  }

  // Iterate through matches
  while ((match = listItemRegex.exec(text)) !== null) {
    foundList = true;
    const itemNumbering = match[1]; // e.g., "1. "
    const itemText = match[2].trim(); // e.g., "First step"

    // Add text preceding this list item
    result += text.substring(lastIndex, match.index);

    // Add the formatted list item (with newline if it's not the first detected item)
    if (result.length > 0 && !result.endsWith('\n')) {
        // Check if the preceding text already ends with a newline or is the start
        // Avoid adding double newlines if the original text had breaks.
        const precedingText = text.substring(0, match.index).trim();
        if (precedingText.length > 0 && !precedingText.endsWith('\n')) {
             result += '\n'; // Add newline before the list item
        }
    }
    result += itemNumbering + itemText;

    // Update lastIndex to the end of the current match
    lastIndex = listItemRegex.lastIndex;

     // Add a newline *after* the item, preparing for the next or the trailing text
     // Check if there's more text potentially following this item before the next numbered item
     const lookaheadCheck = /(\s*\d+\.)|\s*$/.exec(text.substring(lastIndex));
     if (lookaheadCheck && lookaheadCheck[1]) { // Next item exists
         result += '\n';
     }
  }

  // Add any remaining text after the last list item
  result += text.substring(lastIndex);


  // Clean up potential double newlines that might arise from original formatting + added newlines
  result = result.replace(/\n\n/g, '\n');

  // If we went through the motions but didn't actually format (e.g., single item "1. hello"), return original.
  // The check relies on whether we added any newlines based on the logic.
  return foundList ? result.trim() : text;
}

// Simple test cases (can be run with Node)
/*
const testCases = [
  "No list here.",
  "1. Only one item.",
  "Here is a list: 1. First item 2. Second item 3. Third item. That's all.",
  "Another list: 1. Apple 2. Banana 3. Cherry",
  "List with surrounding text. Steps: 1. Go 2. Stop 3. Wait. Done.",
  "  1. Leading space item 2. Middle item   3. Trailing space item  ",
  "Text before 1. Item one 2. Item two and text after.",
  "Multi-line\nText 1. Line one 2. Line two\nMore text.",
  "Edge case 1. one.",
  "1. first 2. second\n3. third 4. fourth", // Mixed newlines
  "Some text 1. a 2. b end."
];

testCases.forEach((tc, index) => {
  console.log(`Test Case ${index + 1}:`);
  console.log("Input: ", JSON.stringify(tc));
  console.log("Output:", JSON.stringify(formatListText(tc)));
  console.log("---");
});
*/ 