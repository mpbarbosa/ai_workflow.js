# ai_personas

**Module:** `src/lib/ai_personas.js`
**Version:** 2.2.16
**Architecture:** Pure functions only

AI persona definitions and management for workflow automation.

---

## Overview

The `ai_personas` module defines 14 specialized AI personas for workflow automation. Each persona has specific expertise, tone, and focus areas tailored to different workflow steps.

### Key Features

- **14 Specialized Personas**: Covering documentation, testing, code quality, security, and more
- **Immutable Definitions**: Persona data never changes at runtime
- **Role-Based Selection**: Get personas by task, expertise, or workflow step
- **Validation**: Ensure persona data integrity
- **Pure Functions**: All operations are deterministic with no side effects

### Available Personas

1. **documentation_expert** - Technical documentation specialist
2. **technical_writer** - Documentation architect and gap analyzer
3. **test_engineer** - Testing and quality assurance specialist
4. **code_reviewer** - Code quality and best practices expert
5. **dependency_manager** - Dependency management and security
6. **accessibility_expert** - UX and accessibility specialist
7. **context_manager** - Context optimization specialist
8. **markdown_linter** - Markdown style and consistency
9. **workflow_coordinator** - Workflow orchestration and planning
10. **git_expert** - Git operations and version control
11. **ci_cd_engineer** - CI/CD pipeline and automation
12. **refactoring_specialist** - Code refactoring and architecture
13. **prompt_engineer** - AI prompt optimization
14. **security_expert** - Security and vulnerability analysis
15. **performance_engineer** - Performance optimization

---

## Installation

```javascript
import {
  getAllPersonas,
  getPersonaById,
  getPersonasByTask,
  validatePersona,
} from './lib/ai_personas.js';
```

---

## Persona Schema

Each persona object has the following structure:

```typescript
{
  id: string;              // Unique identifier
  name: string;            // Display name
  role: string;            // Primary role description
  expertise: string[];     // Areas of expertise
  tone: string;            // Communication tone
  focus: string[];         // Key focus areas
  description: string;     // Detailed description
  useCases: string[];      // Common use cases
}
```

---

## Pure Functions

### getAllPersonas

Get all available personas.

**Signature:**

```javascript
function getAllPersonas(): Persona[]
```

**Returns:**

- (Persona[]): Array of all 14 personas

**Pure:** ✅ Yes

**Example:**

```javascript
const personas = getAllPersonas();
console.log(personas.length);
// 14

console.log(personas[0].name);
// 'Documentation Expert'
```

---

### getPersonaById

Get persona by ID.

**Signature:**

```javascript
function getPersonaById(id: string): Persona | null
```

**Parameters:**

- `id` (string): Persona ID (e.g., 'documentation_expert')

**Returns:**

- (Persona | null): Persona object or null if not found

**Pure:** ✅ Yes

**Example:**

```javascript
const persona = getPersonaById('documentation_expert');
console.log(persona.name);
// 'Documentation Expert'

console.log(persona.expertise);
// ['Technical writing', 'API documentation', ...]

const notFound = getPersonaById('invalid_id');
// null
```

---

### getPersonaByName

Get persona by display name (case-insensitive).

**Signature:**

```javascript
function getPersonaByName(name: string): Persona | null
```

**Parameters:**

- `name` (string): Persona display name (case-insensitive)

**Returns:**

- (Persona | null): Persona object or null if not found

**Pure:** ✅ Yes

**Example:**

```javascript
const persona = getPersonaByName('Test Engineer');
console.log(persona.id);
// 'test_engineer'

const caselessPersona = getPersonaByName('test ENGINEER');
console.log(caselessPersona.id);
// 'test_engineer'

const notFound = getPersonaByName('Unknown Name');
// null
```

---

### getPersonasByTask

Get personas suitable for a specific task or workflow step.

**Signature:**

```javascript
function getPersonasByTask(task: string): Persona[]
```

**Parameters:**

- `task` (string): Task description or workflow step (case-insensitive)

**Returns:**

- (Persona[]): Array of matching personas (may be empty)

**Pure:** ✅ Yes

**Example:**

```javascript
// Find personas for documentation tasks
const docPersonas = getPersonasByTask('documentation');
console.log(docPersonas.map((p) => p.name));
// ['Documentation Expert', 'Technical Writer', 'Markdown Linter']

// Find personas for testing
const testPersonas = getPersonasByTask('test');
console.log(testPersonas.map((p) => p.name));
// ['Test Engineer']

// Find personas for Step 3
const step3Personas = getPersonasByTask('Step 3');
console.log(step3Personas.map((p) => p.name));
// ['Test Engineer']
```

---

### getPersonasByExpertise

Get personas with specific expertise.

**Signature:**

```javascript
function getPersonasByExpertise(expertise: string): Persona[]
```

**Parameters:**

- `expertise` (string): Expertise area (case-insensitive, partial match)

**Returns:**

- (Persona[]): Array of matching personas (may be empty)

**Pure:** ✅ Yes

**Example:**

```javascript
// Find security experts
const securityPersonas = getPersonasByExpertise('security');
console.log(securityPersonas.map((p) => p.name));
// ['Dependency Manager', 'Security Expert', 'CI/CD Engineer']

// Find testing experts
const testingPersonas = getPersonasByExpertise('testing');
console.log(testingPersonas.map((p) => p.name));
// ['Test Engineer']

// Find code quality experts
const qualityPersonas = getPersonasByExpertise('code quality');
console.log(qualityPersonas.map((p) => p.name));
// ['Code Reviewer']
```

---

### validatePersona

Validate persona object structure.

**Signature:**

```javascript
function validatePersona(persona: any): {
  valid: boolean,
  errors: string[]
}
```

**Parameters:**

- `persona` (any): Persona object to validate

**Returns:**

- (Object): Validation result with `valid` boolean and `errors` array

**Pure:** ✅ Yes

**Example:**

```javascript
const validPersona = {
  id: 'custom_expert',
  name: 'Custom Expert',
  role: 'Custom specialist',
  expertise: ['Custom area'],
  tone: 'Professional',
  focus: ['Custom focus'],
  description: 'Custom description',
  useCases: ['Custom use case'],
};

const result = validatePersona(validPersona);
console.log(result);
// { valid: true, errors: [] }

const invalidPersona = {
  id: 'missing_fields',
  name: 'Incomplete',
};

const result2 = validatePersona(invalidPersona);
console.log(result2);
// {
//   valid: false,
//   errors: [
//     'Missing required field: role',
//     'Missing required field: expertise',
//     'Missing required field: tone',
//     'Missing required field: focus',
//     'Missing required field: description',
//     'Missing required field: useCases'
//   ]
// }
```

---

### getPersonaCount

Get count of available personas.

**Signature:**

```javascript
function getPersonaCount(): number
```

**Returns:**

- (number): Total number of personas (currently 14)

**Pure:** ✅ Yes

**Example:**

```javascript
const count = getPersonaCount();
console.log(count);
// 14
```

---

### getPersonaIds

Get all persona IDs.

**Signature:**

```javascript
function getPersonaIds(): string[]
```

**Returns:**

- (string[]): Array of all persona IDs

**Pure:** ✅ Yes

**Example:**

```javascript
const ids = getPersonaIds();
console.log(ids);
// [
//   'documentation_expert',
//   'technical_writer',
//   'test_engineer',
//   'code_reviewer',
//   ...
// ]
```

---

### personaExists

Check if persona exists by ID.

**Signature:**

```javascript
function personaExists(id: string): boolean
```

**Parameters:**

- `id` (string): Persona ID to check

**Returns:**

- (boolean): True if persona exists, false otherwise

**Pure:** ✅ Yes

**Example:**

```javascript
personaExists('documentation_expert');
// true

personaExists('unknown_persona');
// false
```

---

## Usage Examples

### Example 1: Get Documentation Persona

```javascript
import { getPersonaById } from './lib/ai_personas.js';

const persona = getPersonaById('documentation_expert');

console.log(`Name: ${persona.name}`);
console.log(`Role: ${persona.role}`);
console.log(`Tone: ${persona.tone}`);
console.log(`Expertise: ${persona.expertise.join(', ')}`);

// Name: Documentation Expert
// Role: Senior technical documentation specialist
// Tone: Clear, precise, and instructive
// Expertise: Technical writing, API documentation, User guides, Code documentation, Documentation standards
```

---

### Example 2: Find Personas for Workflow Step

```javascript
import { getPersonasByTask } from './lib/ai_personas.js';

// Find persona for Step 1 (Documentation updates)
const step1Personas = getPersonasByTask('Step 1');

if (step1Personas.length > 0) {
  const persona = step1Personas[0];
  console.log(`Using ${persona.name} for documentation updates`);
  console.log(`Focus areas: ${persona.focus.join(', ')}`);
}
```

---

### Example 3: Search by Expertise

```javascript
import { getPersonasByExpertise } from './lib/ai_personas.js';

// Find all personas with security expertise
const securityExperts = getPersonasByExpertise('security');

console.log('Security experts:');
securityExperts.forEach((persona) => {
  console.log(`- ${persona.name}: ${persona.role}`);
});

// Security experts:
// - Dependency Manager: Dependency and package management specialist
// - Security Expert: Senior security and vulnerability analyst
// - CI/CD Engineer: CI/CD and DevOps automation specialist
```

---

### Example 4: Validate Custom Persona

```javascript
import { validatePersona } from './lib/ai_personas.js';

const customPersona = {
  id: 'api_specialist',
  name: 'API Specialist',
  role: 'REST API design expert',
  expertise: ['API design', 'REST architecture', 'OpenAPI'],
  tone: 'Technical and precise',
  focus: ['API consistency', 'REST best practices'],
  description: 'Specializes in REST API design and documentation',
  useCases: ['API design reviews', 'OpenAPI spec validation'],
};

const result = validatePersona(customPersona);

if (result.valid) {
  console.log('Custom persona is valid!');
} else {
  console.error('Validation errors:', result.errors);
}
```

---

### Example 5: List All Personas

```javascript
import { getAllPersonas } from './lib/ai_personas.js';

const personas = getAllPersonas();

console.log('Available AI Personas:\n');
personas.forEach((persona, index) => {
  console.log(`${index + 1}. ${persona.name}`);
  console.log(`   ID: ${persona.id}`);
  console.log(`   Role: ${persona.role}`);
  console.log(`   Primary expertise: ${persona.expertise[0]}`);
  console.log('');
});
```

---

### Example 6: Check Persona Availability

```javascript
import { personaExists, getPersonaById } from './lib/ai_personas.js';

function getPersonaSafely(id) {
  if (!personaExists(id)) {
    console.warn(`Persona '${id}' not found, using default`);
    return getPersonaById('documentation_expert');
  }
  return getPersonaById(id);
}

const persona1 = getPersonaSafely('test_engineer');
// Returns test_engineer persona

const persona2 = getPersonaSafely('nonexistent_persona');
// Warning: Persona 'nonexistent_persona' not found, using default
// Returns documentation_expert persona
```

---

### Example 7: Filter by Multiple Criteria

```javascript
import { getAllPersonas } from './lib/ai_personas.js';

// Find personas that focus on code quality OR security
const qualityAndSecurityPersonas = getAllPersonas().filter((persona) =>
  persona.focus.some(
    (f) => f.toLowerCase().includes('code quality') || f.toLowerCase().includes('security')
  )
);

console.log('Quality & Security Personas:');
qualityAndSecurityPersonas.forEach((persona) => {
  console.log(`- ${persona.name}`);
});

// Quality & Security Personas:
// - Test Engineer
// - Code Reviewer
// - Dependency Manager
// - Security Expert
```

---

## Related Modules

- **[ai_prompt_builder](./ai_prompt_builder.md)** - Build prompts with persona context
- **[ai_helpers](./ai_helpers.md)** - AI request orchestration
- **[ai_validation](./ai_validation.md)** - Validate AI responses

---

## Notes

### Persona Design

Each persona is carefully designed with:

- **Specific expertise**: Narrow focus for optimal results
- **Appropriate tone**: Matches the task domain (technical, user-friendly, security-focused)
- **Clear use cases**: Maps to specific workflow steps
- **Consistent structure**: All personas follow the same schema

### Adding Custom Personas

While personas are immutable at runtime, you can:

1. Extend the PERSONAS array in source code
2. Use `validatePersona()` to ensure schema compliance
3. Follow naming conventions (lowercase_underscore for IDs)

### Performance

- All lookups are O(n) array scans (n=14, negligible)
- No caching needed due to small dataset size
- Pure functions enable safe memoization if needed

### Migration Notes

Migrated from `src/workflow/lib/ai_personas.sh` + `.workflow_core/config/ai_helpers.yaml` with:

- Converted YAML definitions to JavaScript objects
- Added validation and lookup functions
- Maintained all original 14 personas with exact specifications

---

**Last Updated:** 2026-02-07
**Stability:** Stable
**Test Coverage:** 100%
