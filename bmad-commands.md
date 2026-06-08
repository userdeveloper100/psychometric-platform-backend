Searched for files matching `**/.agents/**/*.md`

Read [](file:///c%3A/Users/PardeshiShailendra/OneDrive%20-%20Bridgenext/Documents/Project/psychometric-platform/psychometric-platform-backend/.agents)

Let me check the structure and find documentation on how to use .agents skills.

Ran terminal command: find ".agents" -maxdepth 2 -type f -name "README*" -o -name "*.toml" -o -name "*.yaml" | head -20

Ran terminal command: ls -la .agents/

Ran terminal command: ls .agents/skills | head -20

## Using `.agents\skills` in Your Project

Your project has **40+ specialized AI agent skills** installed locally. These are advanced agents for planning, analysis, development, and testing. Here's how to use them:

### **How to Invoke Skills**

**Basic Syntax:**
```
/[skill-name]
```

**With Arguments (for multi-action skills):**
```
/[skill-name] [action] [args]
```

---

### **Key Agent Skills Available**

#### **🏗️ Planning & Architecture**
| Skill | Command | Purpose |
|-------|---------|---------|
| Create PRD | `/bmad-create-prd` | Generate Product Requirements Document |
| Create Architecture | `/bmad-create-architecture` | Design system architecture |
| Create Epics & Stories | `/bmad-create-epics-and-stories` | Break down work into epics/stories |
| Sprint Planning | `/bmad-sprint-planning` | Plan sprint execution |

#### **👥 Specialized Agents**
| Skill | Command | Purpose |
|-------|---------|---------|
| Agent Dev | `/bmad-agent-dev` | Development implementation expert |
| Agent Architect | `/bmad-agent-architect` | Technical architecture specialist |
| Agent PM | `/bmad-agent-pm` | Product management expert |
| Agent Tech Writer | `/bmad-agent-tech-writer` | Documentation specialist |
| Agent Analyst | `/bmad-agent-analyst` | Data & requirements analyst |
| Agent UX Designer | `/bmad-agent-ux-designer` | UX/UI design expert |

#### **🧪 Testing & Quality**
| Skill | Command | Purpose |
|-------|---------|---------|
| Test Design | `/bmad-testarch-test-design` | Test strategy & planning |
| ATDD | `/bmad-testarch-atdd` | Acceptance Test-Driven Development |
| Test Automation | `/bmad-testarch-automate` | Generate automated tests |
| Code Review | `/bmad-code-review` | Systematic code review |

#### **📚 Development Work**
| Skill | Command | Purpose |
|-------|---------|---------|
| Dev Story | `/bmad-dev-story` | Implement a user story |
| Create Story | `/bmad-create-story` | Prepare & validate story |
| Quick Dev | `/bmad-quick-dev` | Intent-to-code workflow |
| Checkpoint | `/bmad-checkpoint-preview` | Review commits/PRs with context |

#### **📖 Documentation**
| Skill | Command | Purpose |
|-------|---------|---------|
| Write Document | `/bmad-agent-tech-writer write` | Create technical docs |
| Generate Context | `/bmad-generate-project-context` | Scan codebase for LLM context |
| Document Project | `/bmad-document-project` | Auto-document existing project |

---

### **Example Commands**

**1. Start development on a story:**
```
/bmad-dev-story
```

**2. Generate tests for implemented code:**
```
/bmad-qa-generate-e2e-tests
```

**3. Review code before committing:**
```
/bmad-code-review
```

**4. Create technical documentation:**
```
/bmad-agent-tech-writer write
```

**5. Generate acceptance tests (ATDD):**
```
/bmad-testarch-atdd
```

**6. Multi-agent discussion (get multiple perspectives):**
```
/bmad-party-mode
```

---

### **Best Practices**

✅ **Use fresh context** — Run each skill in a new conversation window  
✅ **Follow the workflow** — Skills often have multi-step processes  
✅ **Provide context** — Give input documents/PRDs when asked  
✅ **Save outputs** — Most skills save artifacts to `_bmad-output/`  
✅ **Chain workflows** — Combine skills for complete product cycles  

---

**💡 Quick Start:** Try `/bmad-quick-dev` for a unified intent→code→review workflow, or `/bmad-agent-dev` to deep-dive on implementation.


-----------------------------------------------

Perfect! Here's a comprehensive guide to **Skills & Actions** with examples:

---

## **Skill Actions & Commands**

### **1. Agent Skills (Specialized Personas)**

#### **📚 Paige — Technical Writer**
```bash
/bmad-agent-tech-writer

# Then select from menu:
- WD: Write Document
- MG: Create Mermaid Diagram  
- VD: Validate Documentation
- EC: Explain Concept
- DP: Generate Project Documentation
```

**Examples:**
```
/bmad-agent-tech-writer
# → Paige greets you, shows menu
# Then: "WD" or "write a deployment guide"

/bmad-agent-tech-writer
# → Select: "MG" 
# → Ask: "Create a diagram showing auth flow"
```

---

#### **👨‍💻 Amelia — Senior Developer**
```bash
/bmad-agent-dev
# Menu appears → Select action or describe what to build

# With specific story:
/bmad-dev-story
```

**Examples:**
```
/bmad-agent-dev
# → "Implement the next story" or "CS1.2-user-auth"

/bmad-dev-story
# → Directly starts implementing a story
```

---

#### **🏗️ Architect Agent**
```bash
/bmad-agent-architect
# Architecture design & technical decisions
```

---

#### **👔 PM Agent**
```bash
/bmad-agent-pm
# Product roadmap, prioritization, strategic planning
```

---

#### **👁️ Analyst Agent**
```bash
/bmad-agent-analyst
# Requirements analysis, research, insights
```

---

#### **🎨 UX Designer Agent**
```bash
/bmad-agent-ux-designer
# User interface design, interaction flows, wireframes
```

---

### **2. Workflow Skills (Multi-Step Processes)**

#### **📖 Create Story**
```bash
/bmad-create-story [epic-number] [story-number]

# Examples:
/bmad-create-story 1-2-user-auth
/bmad-create-story
# → Auto-selects next backlog story
```

**What it does:**
- Analyzes PRD, Architecture, Epics
- Loads all context
- Creates comprehensive story file ready for dev
- Updates sprint status

---

#### **🧪 Test Architecture Skills**

**ATDD (Acceptance Test-Driven Development):**
```bash
/bmad-testarch-atdd
# Creates red-phase test scaffolds BEFORE dev work

# Use right after create-story, before dev-story
```

**Test Automation:**
```bash
/bmad-testarch-automate
# Generates automated API & E2E tests AFTER dev work
```

**Test Design:**
```bash
/bmad-testarch-test-design
# Risk-based test planning for your feature
```

---

#### **📝 Quick Dev (Unified Workflow)**
```bash
/bmad-quick-dev
# One skill does it all:
# 1. Clarify intent
# 2. Implement code
# 3. Generate tests
# 4. Code review
# 5. Present results
```

**Example:**
```
/bmad-quick-dev
# → "Fix login form validation to require 8+ chars"
# → Generates code + tests + review + summary
```

---

#### **🔍 Code Review**
```bash
/bmad-code-review
# Review commits, PRs, branches with full context
# Includes compliance checks, refactoring suggestions
```

---

#### **📊 Sprint Planning**
```bash
/bmad-sprint-planning
# Create sprint-status.yaml from epics
# Assigns stories to sprints with priorities
```

---

#### **📈 Checkpoint (PR Review)**
```bash
/bmad-checkpoint-preview
# Guided walkthrough of commits/PRs
# Shows context → details → impact analysis
```

---

### **3. PRD & Planning Skills**

#### **✍️ Create PRD**
```bash
/bmad-create-prd
# Interactive PRD generation with vetting
```

#### **✅ Validate PRD**
```bash
/bmad-validate-prd
/bmad-validate-prd [path-to-prd.md]
# Comprehensive PRD quality audit

# Example:
/bmad-validate-prd _bmad-output/planning-artifacts/prd.md
```

#### **🏗️ Create Architecture**
```bash
/bmad-create-architecture
# Technical design from PRD
```

#### **📋 Create Epics & Stories**
```bash
/bmad-create-epics-and-stories
# Break down architecture into epics/stories
```

---

### **4. Documentation Skills**

#### **📚 Document Project**
```bash
/bmad-document-project
# Auto-analyze codebase, generate documentation
```

#### **🔍 Generate Project Context**
```bash
/bmad-generate-project-context
# Scan codebase → create LLM-optimized project-context.md
# Essential for brownfield projects
```

---

### **5. Support Skills**

#### **🧠 Brainstorming**
```bash
/bmad-brainstorming
# Multi-technique ideation facilitation
```

#### **🎭 Party Mode**
```bash
/bmad-party-mode
# Multi-agent discussion for multiple perspectives
# Agents debate, collaborate, reach consensus

# Example:
/bmad-party-mode
# → Architect + Developer + PM discuss auth strategy
```

#### **🛠️ Correct Course**
```bash
/bmad-correct-course
# Navigate significant changes
# Recommends: update PRD, redo architecture, etc.
```

---

## **Complete Workflow Example**

```bash
# 1. START: Plan the work
/bmad-create-prd
→ Generate product requirements

/bmad-create-architecture
→ Design system architecture

/bmad-create-epics-and-stories
→ Create epics + stories breakdown

/bmad-sprint-planning
→ Organize into sprints

# 2. IMPLEMENT: Build it
/bmad-create-story 1-1-user-auth
→ Comprehensive story context

/bmad-testarch-atdd
→ Write acceptance tests (RED phase)

/bmad-dev-story
→ Implement feature (RED → GREEN → REFACTOR)

/bmad-testarch-automate
→ Generate integration tests

/bmad-code-review
→ Quality audit & approval

# 3. DOCUMENT: Share knowledge
/bmad-agent-tech-writer write
→ Create deployment guide

/bmad-agent-tech-writer mermaid
→ Create architecture diagram

# 4. TRACK: Monitor progress
/bmad-sprint-status
→ See sprint overview
```

---

## **Quick Reference Cheat Sheet**

| Scenario | Command |
|----------|---------|
| Build a feature end-to-end | `/bmad-quick-dev` |
| Get next story ready | `/bmad-create-story` |
| Implement a story | `/bmad-dev-story` |
| Write tests before code | `/bmad-testarch-atdd` |
| Generate tests after code | `/bmad-testarch-automate` |
| Review code quality | `/bmad-code-review` |
| Create API docs | `/bmad-agent-tech-writer write` |
| Create diagrams | `/bmad-agent-tech-writer mermaid` |
| Get multiple perspectives | `/bmad-party-mode` |
| Check sprint progress | `/bmad-sprint-status` |
| Validate your PRD | `/bmad-validate-prd [path]` |

---

**💡 Pro Tip:** Most skills auto-discover your project state. Just run `/bmad-create-story` and it finds the next backlog story automatically!