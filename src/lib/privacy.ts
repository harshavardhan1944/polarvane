// Privacy helpers: Polarvane never shows who wrote a comment, and hides
// @mentions of other people inside comment text.
export function maskMentions(text: string) {
  return text.replace(/(^|[^\w])@[A-Za-z0-9._]{1,30}/g, "$1@someone");
}
