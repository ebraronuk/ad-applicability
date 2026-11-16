# AD Applicability Engine

Given an Airworthiness Directive and a fleet, decide which aircraft it applies
to — and say why, or say what it would need to know.

## The problem

When the FAA issues an Airworthiness Directive, every operator and maintenance
organisation has to answer one question: **does this apply to our aircraft?**
The answer lives in one paragraph of prose, paragraph (c), written like this:

> This AD applies to The Boeing Company Model 787-8, 787-9, and 787-10
> airplanes, certificated in any category, as identified in Boeing Alert
> Requirements Bulletin B787-81205-SB340062-00 RB, Issue 001.

Today someone reads that paragraph and compares it against a fleet list by
hand, for every directive, forever. It is exactly the kind of work that should
be mechanised, and exactly the kind where a confidently wrong answer is worse
than no answer: clearing an aircraft that should be grounded is an
airworthiness event, not a bug report.

## What it does

Parses paragraph (c) into an expression tree, evaluates it against a fleet, and
returns one of three verdicts per aircraft with the reasoning attached:

| Verdict | Meaning |
|---|---|
| **applies** | The clause admits this aircraft, and here is the matching criterion |
| **does not apply** | The clause excludes it, and here is why |
| **undetermined** | The clause depends on a fact the engine does not hold, named explicitly |

## Why "undetermined" is the point

Measured over the corpus in `data/corpus/ads.json`, **35% of real directives do
not state their own applicability.** They defer it to a manufacturer service
bulletin, an installed part number, or a foreign authority's AD — documents that
are not public and that no registry carries.

An engine that guesses there is useless, and an engine that treats the unknown
as "does not apply" is dangerous. So uncertainty is a first-class value that
composes through the whole expression, following Kleene's strong three-valued
logic. The property that matters: **an unknown fact can only widen an answer to
undetermined; it can never flip a definite yes into a definite no.** That is a
property test, not a comment — see below.

A useful consequence falls out of the same logic: one definite refutation
settles a conjunction regardless of any unknown beside it. An aircraft of the
wrong model is out of scope whatever the unresolvable part condition says, which
is why the engine resolves far more of the corpus than the share of
fully-parseable clauses would suggest.

## Coverage, measured

Produced by `npm test` from 196 real directives published between May and
November 2026. Current figures in [`docs/coverage.md`](docs/coverage.md):

```
corpus                 196 directives
parsed                 189 (96.4%)
fully resolvable       100 (51.0%)
deferred to a document  89   (87 service bulletin, 4 installed part, 3 table)
unparsed                 7
```

The thresholds in `tests/coverage.test.ts` are a ratchet: a grammar change that
quietly understands fewer real directives fails the suite rather than passing
unnoticed.

## What it does not do

Stated plainly, because the boundary is a design decision rather than a to-do
list:

- **No compliance-time arithmetic.** Directives set deadlines in flight hours,
  cycles or calendar months from an anchor event. Utilisation data is not
  public, so the engine does not pretend to compute due dates.
- **No service bulletin library.** Manufacturer bulletins are not public. This
  is the cause of the 35% deferral rate and it is not solvable from open data.
- **No modification state.** The registry does not record which bulletins an
  aircraft has had incorporated, so "except those on which SB X has been
  incorporated" resolves to undetermined by construction.
- **US registry only.** EASA ADs and non-US registries are out of scope.
- **Serial comparison is deliberately partial.** Ordering is defined only
  between serials of the same recognised shape; anything else returns
  undetermined rather than a guess. Refusing to compare is the feature.

## Running it

```
npm install
npm test          # suite + writes docs/coverage.md
npm run typecheck
```

To refresh the corpus from the Federal Register:

```
python3 scripts/fetch-corpus.py
```

The corpus is committed on purpose. Every coverage figure above has to be
reproducible offline, and the text the parser is measured against must be the
regulator's wording rather than examples chosen to flatter the parser.

## How this was built

Written with coding agents (Claude Code), under gates that do not depend on
anyone remembering a convention. Three defects review actually caught, because
the claim is worth nothing without them:

1. **A parser that swallowed an ASCII table and reported it as an aircraft
   model.** AD 2026-22785 opens *"Lycoming Engines (Lycoming) Model engines
   identified in table 1 ..."*, where the word after `Model` **is** the category
   word. A lazy match cannot stop on a zero-length run, so it continued to a
   later occurrence of "engines" and captured a table rule line in between. Not
   a crash and not a refusal — a confident wrong answer, the class no type
   checker sees. Found by a property test over all 196 clauses (no extracted
   model may contain a category word); it failed on exactly one. A test written
   from examples I had already read would have passed.
2. **Alternative model groups conjoined instead of disjoined.** Directives that
   reference their own sub-paragraphs produce several model runs in one clause.
   Combining them with AND resolved every such directive to "does not apply"
   for an entire fleet, since no aircraft is both an A330-243 and an A330-941 —
   a clean, confident, universal false negative.
3. **A no-op conditional in the negation combinator**, whose two branches were
   both the empty array. It type-checked and passed the tests that existed,
   silently dropping the reasoning from every exclusion. Caught reading the
   diff, not by a test, and the real finding was the gap: nothing asserted on
   the *content* of a refutation, only on its verdict kind.

What is enforced mechanically rather than by instruction:

- **Totality** of the evaluator is a compile-time guarantee. The switch over
  the node type ends in a `never` assignment, so adding a node kind without
  handling it fails `tsc`.
- **Monotonicity** of the three-valued logic is a property test. Reverting
  `conjoin` to treat undetermined as a refutation fails it — verified
  deliberately, not assumed.
- **Coverage** is a ratchet, as above.

## Licence

MIT
