# Review log

This project was written with coding agents. This file records the defects that
review caught, because a claim that generated code was reviewed is worth
nothing without the evidence, and the industry research is blunt about the
failure mode: a human who approves a diff they cannot realistically evaluate is
not a check, they are a rubber stamp.

Every entry below is a real defect in code an agent produced, with how it was
found. Entries are added when something is caught, not retrospectively.

---

## 1. `exclude()` built its reason list from a condition with two identical branches

**What was wrong.** The negation combinator contained
`...base.because === undefined ? [] : []`, a conditional whose branches are both
the empty array. It type-checked, it passed the tests that existed at the time,
and it did nothing. The intent had been to carry the base clause's reasons into
the refutation; the expression as written silently dropped them, so an aircraft
excluded by an "except" clause would have come back with no explanation of why
it was in scope to begin with.

**How it was found.** Reading the diff before committing, not by a test. No test
existed that asserted on the *content* of a refutation's reason list, only on
its verdict kind, so nothing would have caught it. That gap is the real finding
here: the verdict assertions were too shallow.

**Fix.** Replaced with a single explicit reason string.

**Honest note on the history.** This was caught before the first commit, so it
does not appear in `git log` as a separate `fix:`. It is recorded here rather
than reconstructed into history after the fact.

---

## 2. The model-run pattern swallowed an ASCII table and reported it as an aircraft model

**What was wrong.** `MODEL_RUN` matched lazily up to the first category word
("airplanes", "helicopters", "engines"). For AD 2026-22785, whose clause opens
*"This AD applies to Lycoming Engines (Lycoming) Model engines identified in
table 1 to paragraph (c) ..."*, the word immediately after `Model` **is** the
category word. A lazy match cannot stop on a zero-length run, so it ran on to a
much later occurrence of "engines" in the document and captured everything in
between, including the rule line of an embedded ASCII table. The parser then
reported an aircraft model named
`Engines ------------------------------------------------------------------------`.

That is the dangerous class of parser bug: not a crash, not a refusal, but a
confident wrong answer that no type checker can see.

**How it was found.** By a test asserting a property over the whole corpus
rather than over hand-picked examples: no extracted model designation may
contain a category word. It failed on exactly one of 196 directives. A test
written from examples I had already looked at would have passed.

**Fix.** The run is now tempered, so it cannot contain a category word at all
and "Model engines" correctly yields no designation. A second filter rejects
parts that are mostly dash characters, since directives embed ASCII tables whose
rule lines survive whitespace normalisation.

**Honest note on the history.** Caught while the parser was still unstaged, so
the fix landed inside `feat(applicability): parse paragraph (c) into an
applicability tree` rather than as a separate `fix:` commit. The reasoning is
preserved in a comment above `MODEL_RUN`, which names both the first and the
second version of the bug. Writing a `fix:` commit after the fact to make the
history look better would have been the dishonest option.

---

## 3. Alternative model groups were conjoined instead of disjoined

**What was wrong.** A directive that says *"applies to all Airbus SAS airplanes
specified in paragraphs (c)(1) and (2)"* then spells those sub-paragraphs out in
the same clause, producing several `Model ... airplanes` runs. The first version
combined them with AND. No aircraft is simultaneously an A330-243 and an
A330-941, so every directive of that shape resolved to "does not apply" for the
entire fleet, which is the worst possible failure direction in a compliance
tool: a clean, confident, universal false negative.

**How it was found.** Reasoning about the measured pattern distribution before
writing the combinator, rather than after. 16.3% of the corpus refers to its own
sub-paragraphs, so the shape was too common to leave to chance.

**Fix.** Model groups compose with OR. The reason is recorded in a comment at
the call site so the next person does not "simplify" it back.

---

## What the gates now catch without a human

Prose instructions are weaker than checks, so the rules above that can be
mechanised have been:

- **Totality of the evaluator** is enforced by the compiler. The switch over
  `ApplicabilityNode` ends in a `never` assignment, so adding a node kind
  without handling it fails `tsc`.
- **Monotonicity of the three-valued logic** is a property test. Reverting
  `conjoin` to treat undetermined as a refutation fails it, which was verified
  deliberately rather than assumed.
- **Parser coverage** is a ratchet in `tests/coverage.test.ts`. A grammar change
  that quietly understands fewer real directives fails the suite instead of
  passing unnoticed.
- **No model designation may contain a category word**, over the whole corpus.
  This is defect 2, pinned.
