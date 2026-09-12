"""Real customer questions, with what the knowledge base can honestly answer.

WHY THE EXPECTATIONS ARE PART OF THE DATA. A RAG system has two ways to be
wrong and only one of them is obvious. Answering badly is visible. Answering
confidently about something the corpus does not contain is not — it reads
exactly like a good answer. So every question below is labelled with what
*should* happen, and the `REFUSE` cases are as important as the others.

HOW THE REFUSE CASES WERE CHOSEN. Not invented to be easy. Each is something
a real customer would plausibly ask and the corpus genuinely does not cover:

  * Prices in figures — the solutions carry bands ("On survey", "Entry to
    mid"), never numbers.
  * Founders — data/about.js leaves the founding story deliberately blank,
    marked "JAAZ to confirm".
  * Partner brands — the partner list is unconfirmed; only brands with a
    confirmed commercial relationship should ever be presented as partners.
  * Named principals — the team biographies are placeholders that "do not
    depict real people at JAAZ".
  * The X200 — a product that does not exist in JAAZ's material. It appeared
    only in a test document written during development, and asking for it
    now is the sharpest available check that the assistant is reading the
    corpus rather than remembering.

`expect_contains` is a fact that must appear in the answer AND in at least
one cited passage. That second half is what separates a citation from a
decoration: it proves the source actually supports the sentence it is
attached to.
"""

from __future__ import annotations

from dataclasses import dataclass, field

ANSWER = "answer"
REFUSE = "refuse"


@dataclass(frozen=True)
class Question:
    text: str
    category: str
    expect: str
    # A fact that must be present in the answer and in a cited passage.
    expect_contains: tuple[str, ...] = field(default_factory=tuple)
    note: str = ""


QUESTIONS: tuple[Question, ...] = (
    # -- product and specification ------------------------------------------
    Question("What channel layout does a JAAZ private home theatre use?",
             "product", ANSWER, ("Atmos",)),
    Question("What screen sizes do you specify for a dedicated cinema?",
             "product", ANSWER, ("2.35:1",)),
    Question("How many seats does a private home theatre have?",
             "product", ANSWER, ("14",)),
    Question("What reverberation time do you target in a cinema room?",
             "product", ANSWER, ("0.2",)),
    Question("What sound isolation do you target to adjacent rooms?",
             "product", ANSWER, ("dB",)),
    Question("How long does a dedicated cinema build take?",
             "product", ANSWER, ("weeks",)),
    Question("What is the difference between the private home theatre and the "
             "living room theatre upgrade?", "product", ANSWER),
    Question("How many days on site does a living room upgrade need?",
             "product", ANSWER),

    # -- solutions and recommendation ---------------------------------------
    Question("What would you recommend for a private home theatre?",
             "solution", ANSWER),
    Question("What audio system is suitable for a large living room?",
             "solution", ANSWER),
    Question("Can JAAZ integrate lighting and audio together?",
             "solution", ANSWER),
    Question("What do you offer for an outdoor terrace?",
             "solution", ANSWER),
    Question("Do you do audio for bars and lounges?",
             "solution", ANSWER),
    Question("Which solution should I choose if I cannot do any civil work?",
             "solution", ANSWER),
    Question("What is your flagship solution?",
             "solution", ANSWER),
    Question("Do you offer home automation and control?",
             "solution", ANSWER),
    Question("What lighting design services are available?",
             "solution", ANSWER),
    Question("What seating options does JAAZ provide?",
             "solution", ANSWER),
    Question("What is acoustic treatment and room engineering?",
             "solution", ANSWER),
    Question("What solutions does JAAZ offer in total?",
             "solution", ANSWER),

    # -- installation and process -------------------------------------------
    Question("Do you provide installation?", "installation", ANSWER),
    Question("Do I need a site survey before you quote?",
             "installation", ANSWER, ("survey",)),
    Question("How does a JAAZ project run from start to finish?",
             "installation", ANSWER),
    Question("Can the speakers be hidden inside the wall?",
             "installation", ANSWER),
    Question("Do you work outside Kochi?", "installation", ANSWER, ("Gulf",)),

    # -- warranty and service ------------------------------------------------
    Question("What is covered under warranty?", "warranty", ANSWER),
    Question("How long is the warranty?", "warranty", ANSWER,
             ("thirty-six",)),
    Question("When are calibration visits included?", "warranty", ANSWER),

    # -- company and contact -------------------------------------------------
    Question("What are your working hours?", "company", ANSWER, ("10",)),
    Question("Where is JAAZ located?", "company", ANSWER, ("Kochi",)),
    Question("How quickly will I hear back after an enquiry?",
             "company", ANSWER, ("working day",)),
    Question("How many projects has JAAZ delivered?", "company", ANSWER),
    Question("What should I send with my enquiry?", "company", ANSWER),
    Question("What projects has JAAZ completed?", "company", ANSWER),

    # -- must refuse ---------------------------------------------------------
    Question("What subwoofer comes with the X200, and how many watts is it?",
             "unknown", REFUSE,
             note="No such product in JAAZ material. It existed only in a "
                  "development test document."),
    Question("How much does a private home theatre cost in rupees?",
             "unknown", REFUSE,
             note="The corpus carries bands, never figures."),
    Question("Who founded JAAZ and in what year?", "unknown", REFUSE,
             note="The founding story is deliberately blank, JAAZ to confirm."),
    Question("Which brands does JAAZ partner with?", "unknown", REFUSE,
             note="The partner list is unconfirmed and was not indexed."),
    Question("Who are the two principals at JAAZ and what are their names?",
             "unknown", REFUSE,
             note="Team biographies are placeholders, not real people."),
    Question("Do you install swimming pools?", "unknown", REFUSE,
             note="Not a JAAZ service."),
    Question("What is the capital of France?", "unknown", REFUSE,
             note="Entirely outside the corpus."),
    Question("What discount can I get if I book this month?",
             "unknown", REFUSE,
             note="No pricing or promotion information exists."),
)


def by_category() -> dict[str, list[Question]]:
    grouped: dict[str, list[Question]] = {}
    for question in QUESTIONS:
        grouped.setdefault(question.category, []).append(question)
    return grouped
