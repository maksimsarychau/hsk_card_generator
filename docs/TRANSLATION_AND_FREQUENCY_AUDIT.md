# Translation And Frequency Audit

Date: 2026-05-16

## Current Status

The current HSK datasets are HSK-first vocabulary sets. They are useful for Chinese study, but they are not evidence of the 300 most frequent English or Hungarian words.

The `Core multilingual 300` and `English-Hungarian core 300` app datasets are currently starter multilingual sets generated from the prepared HSK 3.0 multilingual rows. They should be treated as printable starter material, not as verified language-specific frequency lists.

## Frequency Source Check

English frequency sources found:

- Wiktionary English frequency lists index: includes English Wikipedia, TV/movie scripts, Project Gutenberg, Basic English and related lists.
- Simple English Wiktionary: most frequent 1000 English words.
- SUBTLEX-US: English/American movie and TV subtitle frequency database.

Hungarian frequency sources found:

- Wiktionary Hungarian wordlist: 5000 common Hungarian words based on OpenSubtitles.
- Wiktionary Hungarian frequency list index: links to webcorpus, Hungarian National Corpus and Leipzig Corpora resources.
- Hungarian Wiktionary frequency appendix.

Important conclusion: English top-300 and Hungarian top-300 are different source lists. A Hungarian top-300 deck must start from Hungarian words, not from translated English words. An English top-300 deck must start from English frequency data, not from HSK words.

## Translation QA Notes

The current translations are suitable for preview/prototyping and manual correction, but not fully certified. Known risks:

- high-frequency function words often have several meanings;
- Chinese equivalents depend on part of speech and context;
- Russian and Hungarian translations may need shorter printable variants;
- pinyin is only reliable when the Chinese headword is fixed and reviewed;
- frequency lists contain forms, while learning decks often need lemmas.

## Recommended Next Dataset Milestone

1. Import a source-ranked English top-300 list.
2. Import a source-ranked Hungarian top-300 list.
3. Create two separate reviewed datasets:
   - `english_top_300_reviewed`
   - `hungarian_top_300_reviewed`
4. For each row, store:
   - source rank;
   - source language lemma/form;
   - English;
   - Hungarian;
   - Russian;
   - Chinese;
   - pinyin;
   - review status.
5. Keep printable text separate from original translation text, using the existing `orig` / `recommended` workflow.

## Practical Rule For This App

Use HSK sets for Chinese-first learning.

Use language-specific top-300 sets only after importing and reviewing language-specific frequency lists.

