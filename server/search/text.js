export function compactText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function collapseAdjacentRepeatedPhrases(value) {
  let words = compactText(value).split(/\s+/).filter(Boolean);
  if (words.length < 2) return words.join(" ");

  for (let size = Math.floor(words.length / 2); size >= 1; size -= 1) {
    const nextWords = [];

    for (let index = 0; index < words.length; index += 1) {
      const current = words.slice(index, index + size);
      const next = words.slice(index + size, index + size * 2);
      const currentText = current.join(" ").toLowerCase();
      const nextText = next.join(" ").toLowerCase();

      if (current.length === size && next.length === size && currentText === nextText) {
        nextWords.push(...current);
        index += size * 2 - 1;

        while (
          words
            .slice(index + 1, index + 1 + size)
            .join(" ")
            .toLowerCase() === currentText
        ) {
          index += size;
        }
      } else {
        nextWords.push(words[index]);
      }
    }

    words = nextWords;
  }

  return words.join(" ");
}

export function sanitizeQuery(value) {
  let query = compactText(value)
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/[<>]/g, "")
    .slice(0, 240);

  for (let pass = 0; pass < 3; pass += 1) {
    query = collapseAdjacentRepeatedPhrases(query);
  }

  return query;
}

export function cacheKey(query, category) {
  return `${category || "web"}:${compactText(query).toLowerCase()}`;
}
