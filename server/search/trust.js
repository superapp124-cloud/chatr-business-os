export function getDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function getSourceTrust(url, title = "") {
  const domain = getDomain(url);
  const haystack = `${domain} ${title}`.toLowerCase();

  if (
    /\b(gsmarena\.com|91mobiles\.com|smartprix\.com|gadgets360\.com|techradar\.com|androidauthority\.com|tomsguide\.com|digit\.in|mysmartprice\.com|pricebaba\.com)\b/.test(
      haystack,
    )
  ) {
    return { trustTier: "commerce_review", trustLabel: "Review/Catalogue", trustScore: 88 };
  }

  if (/\b(flipkart\.com|amazon\.in|croma\.com|reliancedigital\.in|vijaysales\.com)\b/.test(haystack)) {
    return { trustTier: "marketplace", trustLabel: "Marketplace", trustScore: 78 };
  }

  if (/\b(gov\.in|nic\.in|rbi\.org\.in|sebi\.gov\.in|incometax\.gov\.in|uidai\.gov\.in)\b/.test(haystack)) {
    return { trustTier: "government", trustLabel: "Government", trustScore: 100 };
  }

  if (/\b(iplt20\.com|bcci\.tv|icc-cricket\.com|docs\.|developer\.|github\.com)\b/.test(haystack)) {
    return { trustTier: "official", trustLabel: "Official", trustScore: 92 };
  }

  if (
    /\b(reuters\.com|apnews\.com|thehindu\.com|indianexpress\.com|timesofindia\.indiatimes\.com|moneycontrol\.com|espncricinfo\.com|ndtv\.com|hindustantimes\.com)\b/.test(
      haystack,
    )
  ) {
    return { trustTier: "major_media", trustLabel: "Verified News", trustScore: 82 };
  }

  if (/\b(stackoverflow\.com|reddit\.com|news\.ycombinator\.com)\b/.test(haystack)) {
    return { trustTier: "community", trustLabel: "Community", trustScore: 54 };
  }

  if (/\b(youtube\.com|youtu\.be)\b/.test(haystack)) {
    return { trustTier: "video_review", trustLabel: "Video Review", trustScore: 48 };
  }

  if (/\b(blog|medium\.com|substack\.com)\b/.test(haystack)) {
    return { trustTier: "blog", trustLabel: "Blog", trustScore: 38 };
  }

  return { trustTier: "web", trustLabel: "Web", trustScore: 60 };
}
