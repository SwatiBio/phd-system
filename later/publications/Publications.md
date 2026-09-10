# Publications tracker

**Live table below (Bases).** One note per publication — create it in the CMS (`/admin/` → Publications).

**Requirement (MAHE §19):** 2 first-author Scopus/WoS papers (1 review + 1 thesis original) **or** 1 first-author Q1 original — published/accepted **before synopsis**. Plus 2 conference presentations **with certificates**.

```base
filters:
  and:
    - file.inFolder("later/publications")
views:
  - type: table
    name: All publications
  - type: table
    name: Journals
    filters:
      and:
        - type == "journal"
  - type: table
    name: Conferences
    filters:
      and:
        - type == "conference"
```
