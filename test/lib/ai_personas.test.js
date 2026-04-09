/**
 * @fileoverview Tests for ai_personas module
 * @module test/lib/ai_personas.test
 */

import {
  getAllPersonas,
  getPersonaById,
  getPersonaByName,
  getPersonasByTask,
  getPersonasByExpertise,
  validatePersona,
  getPersonaCount,
  getPersonaIds,
  personaExists,
} from '../../src/lib/ai_personas.js';

// =============================================================================
// PURE FUNCTION TESTS
// =============================================================================

describe('ai_personas - Pure Functions', () => {
  // ---------------------------------------------------------------------------
  // getAllPersonas
  // ---------------------------------------------------------------------------

  describe('getAllPersonas', () => {
    test('returns all personas', () => {
      const personas = getAllPersonas();
      expect(Array.isArray(personas)).toBe(true);
      expect(personas.length).toBeGreaterThan(0);
    });

    test('returns 18 personas', () => {
      const personas = getAllPersonas();
      expect(personas).toHaveLength(18);
    });

    test('all personas have required fields', () => {
      const personas = getAllPersonas();
      const requiredFields = [
        'id',
        'name',
        'role',
        'expertise',
        'tone',
        'focus',
        'description',
        'useCases',
      ];

      personas.forEach((persona) => {
        requiredFields.forEach((field) => {
          expect(persona).toHaveProperty(field);
        });
      });
    });

    test('returns immutable copy (changes do not affect source)', () => {
      const personas1 = getAllPersonas();
      personas1[0].id = 'modified';

      const personas2 = getAllPersonas();
      expect(personas2[0].id).not.toBe('modified');
    });

    test('all persona IDs are unique', () => {
      const personas = getAllPersonas();
      const ids = personas.map((p) => p.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    test('all persona names are unique', () => {
      const personas = getAllPersonas();
      const names = personas.map((p) => p.name);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });
  });

  // ---------------------------------------------------------------------------
  // getPersonaById
  // ---------------------------------------------------------------------------

  describe('getPersonaById', () => {
    test('returns correct persona by ID', () => {
      const persona = getPersonaById('documentation_expert');
      expect(persona).not.toBeNull();
      expect(persona.id).toBe('documentation_expert');
      expect(persona.name).toBe('Documentation Expert');
    });

    test('returns null for non-existent ID', () => {
      const persona = getPersonaById('non_existent');
      expect(persona).toBeNull();
    });

    test('returns null for empty string', () => {
      const persona = getPersonaById('');
      expect(persona).toBeNull();
    });

    test('returns null for non-string input', () => {
      expect(getPersonaById(null)).toBeNull();
      expect(getPersonaById(undefined)).toBeNull();
      expect(getPersonaById(123)).toBeNull();
    });

    test('returns immutable copy', () => {
      const persona1 = getPersonaById('test_engineer');
      persona1.name = 'Modified';

      const persona2 = getPersonaById('test_engineer');
      expect(persona2.name).toBe('Test Engineer');
    });

    test('finds all expected personas', () => {
      const expectedIds = [
        'documentation_expert',
        'technical_writer',
        'test_engineer',
        'code_quality_analyst',
        'git_specialist',
        'ux_analyst',
        'prompt_engineer',
        'security_expert',
        'performance_engineer',
        'dependency_analyst',
        'architecture_reviewer',
        'api_designer',
        'devops_engineer',
        'accessibility_expert',
        'async_performance_engineer',
      ];

      expectedIds.forEach((id) => {
        const persona = getPersonaById(id);
        expect(persona).not.toBeNull();
        expect(persona.id).toBe(id);
      });
    });
  });

  // ---------------------------------------------------------------------------
  // getPersonaByName
  // ---------------------------------------------------------------------------

  describe('getPersonaByName', () => {
    test('returns correct persona by name', () => {
      const persona = getPersonaByName('Documentation Expert');
      expect(persona).not.toBeNull();
      expect(persona.name).toBe('Documentation Expert');
      expect(persona.id).toBe('documentation_expert');
    });

    test('returns null for non-existent name', () => {
      const persona = getPersonaByName('Non Existent');
      expect(persona).toBeNull();
    });

    test('returns null for empty string', () => {
      const persona = getPersonaByName('');
      expect(persona).toBeNull();
    });

    test('returns null for non-string input', () => {
      expect(getPersonaByName(null)).toBeNull();
      expect(getPersonaByName(undefined)).toBeNull();
      expect(getPersonaByName(123)).toBeNull();
    });

    test('is case-sensitive', () => {
      const persona = getPersonaByName('documentation expert');
      expect(persona).toBeNull();
    });

    test('returns immutable copy', () => {
      const persona1 = getPersonaByName('Test Engineer');
      persona1.id = 'modified';

      const persona2 = getPersonaByName('Test Engineer');
      expect(persona2.id).toBe('test_engineer');
    });
  });

  // ---------------------------------------------------------------------------
  // getPersonasByTask
  // ---------------------------------------------------------------------------

  describe('getPersonasByTask', () => {
    test('returns documentation personas', () => {
      const personas = getPersonasByTask('documentation');
      expect(personas).toHaveLength(2);
      const ids = personas.map((p) => p.id);
      expect(ids).toContain('documentation_expert');
      expect(ids).toContain('technical_writer');
    });

    test('returns testing personas', () => {
      const personas = getPersonasByTask('testing');
      expect(personas).toHaveLength(1);
      expect(personas[0].id).toBe('test_engineer');
    });

    test('returns code quality personas', () => {
      const personas = getPersonasByTask('code-quality');
      expect(personas).toHaveLength(1);
      expect(personas[0].id).toBe('code_quality_analyst');
    });

    test('returns git personas', () => {
      const personas = getPersonasByTask('git');
      expect(personas).toHaveLength(1);
      expect(personas[0].id).toBe('git_specialist');
    });

    test('returns security personas', () => {
      const personas = getPersonasByTask('security');
      expect(personas.length).toBeGreaterThanOrEqual(1);
      const ids = personas.map((p) => p.id);
      expect(ids).toContain('security_expert');
    });

    test('returns async-performance personas', () => {
      const personas = getPersonasByTask('async-performance');
      expect(personas.length).toBeGreaterThanOrEqual(1);
      const ids = personas.map((p) => p.id);
      expect(ids).toContain('async_performance_engineer');
    });

    test('returns accessibility personas', () => {
      const personas = getPersonasByTask('accessibility');
      expect(personas.length).toBeGreaterThanOrEqual(1);
      const ids = personas.map((p) => p.id);
      expect(ids).toContain('accessibility_expert');
    });

    test('returns empty array for unknown task', () => {
      const personas = getPersonasByTask('unknown_task');
      expect(personas).toEqual([]);
    });

    test('returns empty array for empty string', () => {
      const personas = getPersonasByTask('');
      expect(personas).toEqual([]);
    });

    test('returns empty array for non-string input', () => {
      expect(getPersonasByTask(null)).toEqual([]);
      expect(getPersonasByTask(undefined)).toEqual([]);
      expect(getPersonasByTask(123)).toEqual([]);
    });

    test('is case-insensitive', () => {
      const lower = getPersonasByTask('documentation');
      const upper = getPersonasByTask('DOCUMENTATION');
      expect(lower).toEqual(upper);
    });

    test('handles all task types', () => {
      const taskTypes = [
        'documentation',
        'testing',
        'code-quality',
        'consistency',
        'git',
        'security',
        'performance',
        'dependencies',
        'architecture',
        'api',
        'devops',
        'accessibility',
        'ux',
        'prompts',
        'async-performance',
      ];

      taskTypes.forEach((task) => {
        const personas = getPersonasByTask(task);
        expect(Array.isArray(personas)).toBe(true);
        expect(personas.length).toBeGreaterThan(0);
      });
    });
  });

  // ---------------------------------------------------------------------------
  // getPersonasByExpertise
  // ---------------------------------------------------------------------------

  describe('getPersonasByExpertise', () => {
    test('finds personas by expertise area', () => {
      const personas = getPersonasByExpertise('documentation');
      expect(personas.length).toBeGreaterThan(0);
      personas.forEach((persona) => {
        const hasExpertise = persona.expertise.some((exp) =>
          exp.toLowerCase().includes('documentation')
        );
        expect(hasExpertise).toBe(true);
      });
    });

    test('finds security personas', () => {
      const personas = getPersonasByExpertise('security');
      expect(personas.length).toBeGreaterThan(0);
    });

    test('finds testing personas', () => {
      const personas = getPersonasByExpertise('test');
      expect(personas.length).toBeGreaterThan(0);
    });

    test('is case-insensitive', () => {
      const lower = getPersonasByExpertise('security');
      const upper = getPersonasByExpertise('SECURITY');
      expect(lower.length).toBe(upper.length);
    });

    test('returns empty array for non-matching expertise', () => {
      const personas = getPersonasByExpertise('nonexistent_expertise');
      expect(personas).toEqual([]);
    });

    test('returns empty array for empty string', () => {
      const personas = getPersonasByExpertise('');
      expect(personas).toEqual([]);
    });

    test('returns empty array for non-string input', () => {
      expect(getPersonasByExpertise(null)).toEqual([]);
      expect(getPersonasByExpertise(undefined)).toEqual([]);
      expect(getPersonasByExpertise(123)).toEqual([]);
    });

    test('returns immutable copies', () => {
      const personas1 = getPersonasByExpertise('security');
      personas1[0].name = 'Modified';

      const personas2 = getPersonasByExpertise('security');
      expect(personas2[0].name).not.toBe('Modified');
    });
  });

  // ---------------------------------------------------------------------------
  // validatePersona
  // ---------------------------------------------------------------------------

  describe('validatePersona', () => {
    test('validates correct persona structure', () => {
      const persona = getPersonaById('documentation_expert');
      const result = validatePersona(persona);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('validates all default personas', () => {
      const personas = getAllPersonas();
      personas.forEach((persona) => {
        const result = validatePersona(persona);
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
      });
    });

    test('rejects null', () => {
      const result = validatePersona(null);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('rejects undefined', () => {
      const result = validatePersona(undefined);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('rejects non-object', () => {
      const result = validatePersona('not an object');
      expect(result.valid).toBe(false);
    });

    test('detects missing required fields', () => {
      const persona = { id: 'test' };
      const result = validatePersona(persona);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.includes('Missing required field'))).toBe(true);
    });

    test('validates field types', () => {
      const persona = {
        id: 123, // Should be string
        name: 'Test',
        role: 'Role',
        expertise: 'not-array', // Should be array
        tone: 'Tone',
        focus: 'not-array', // Should be array
        description: 'Description',
        useCases: 'not-array', // Should be array
      };
      const result = validatePersona(persona);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('detects invalid id type', () => {
      const persona = {
        id: 123,
        name: 'Test',
        role: 'Role',
        expertise: [],
        tone: 'Tone',
        focus: [],
        description: 'Description',
        useCases: [],
      };
      const result = validatePersona(persona);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('id must be a string'))).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // getPersonaCount
  // ---------------------------------------------------------------------------

  describe('getPersonaCount', () => {
    test('returns correct count', () => {
      const count = getPersonaCount();
      expect(count).toBe(18);
    });

    test('matches getAllPersonas length', () => {
      const count = getPersonaCount();
      const personas = getAllPersonas();
      expect(count).toBe(personas.length);
    });
  });

  // ---------------------------------------------------------------------------
  // getPersonaIds
  // ---------------------------------------------------------------------------

  describe('getPersonaIds', () => {
    test('returns all persona IDs', () => {
      const ids = getPersonaIds();
      expect(Array.isArray(ids)).toBe(true);
      expect(ids).toHaveLength(18);
    });

    test('all IDs are strings', () => {
      const ids = getPersonaIds();
      ids.forEach((id) => {
        expect(typeof id).toBe('string');
      });
    });

    test('contains expected IDs', () => {
      const ids = getPersonaIds();
      expect(ids).toContain('documentation_expert');
      expect(ids).toContain('technical_writer');
      expect(ids).toContain('test_engineer');
      expect(ids).toContain('security_expert');
    });

    test('matches getAllPersonas IDs', () => {
      const ids1 = getPersonaIds();
      const personas = getAllPersonas();
      const ids2 = personas.map((p) => p.id);
      expect(ids1).toEqual(ids2);
    });
  });

  // ---------------------------------------------------------------------------
  // personaExists
  // ---------------------------------------------------------------------------

  describe('personaExists', () => {
    test('returns true for existing persona', () => {
      expect(personaExists('documentation_expert')).toBe(true);
      expect(personaExists('test_engineer')).toBe(true);
      expect(personaExists('security_expert')).toBe(true);
    });

    test('returns false for non-existent persona', () => {
      expect(personaExists('non_existent')).toBe(false);
      expect(personaExists('unknown_persona')).toBe(false);
    });

    test('returns false for empty string', () => {
      expect(personaExists('')).toBe(false);
    });

    test('returns false for non-string input', () => {
      expect(personaExists(null)).toBe(false);
      expect(personaExists(undefined)).toBe(false);
      expect(personaExists(123)).toBe(false);
    });

    test('checks all default personas exist', () => {
      const ids = getPersonaIds();
      ids.forEach((id) => {
        expect(personaExists(id)).toBe(true);
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Persona Content Tests
  // ---------------------------------------------------------------------------

  describe('Persona Content', () => {
    test('Documentation Expert has correct properties', () => {
      const persona = getPersonaById('documentation_expert');
      expect(persona.name).toBe('Documentation Expert');
      expect(persona.role).toContain('documentation');
      expect(persona.expertise).toContain('Technical writing');
      expect(persona.useCases.length).toBeGreaterThan(0);
    });

    test('Technical Writer has correct properties', () => {
      const persona = getPersonaById('technical_writer');
      expect(persona.name).toBe('Technical Writer');
      expect(persona.role).toContain('technical writer');
      expect(persona.description).toContain('from scratch');
    });

    test('Test Engineer has correct properties', () => {
      const persona = getPersonaById('test_engineer');
      expect(persona.name).toBe('Test Engineer');
      expect(persona.expertise).toContain('Test design');
      expect(persona.focus).toContain('Test coverage');
    });

    test('Security Expert has security-related expertise', () => {
      const persona = getPersonaById('security_expert');
      expect(persona.name).toBe('Security Expert');
      expect(persona.expertise.some((e) => e.toLowerCase().includes('security'))).toBe(true);
    });

    test('AWS Serverless Engineer has correct properties', () => {
      const persona = getPersonaById('aws_serverless_engineer');
      expect(persona.name).toBe('AWS Serverless Engineer');
      expect(persona.role).toContain('AWS serverless');
      expect(persona.expertise).toContain('AWS Lambda');
      expect(persona.expertise).toContain('Amazon API Gateway');
      expect(persona.expertise).toContain('AWS Location Service');
      expect(persona.useCases.length).toBeGreaterThan(0);
    });

    test('Async Performance Engineer has correct properties', () => {
      const persona = getPersonaById('async_performance_engineer');
      expect(persona).not.toBeNull();
      expect(persona.name).toBe('Async Performance Engineer');
      expect(persona.role.toLowerCase()).toContain('async');
      expect(persona.expertise).toContain('Promise anti-patterns');
      expect(persona.expertise).toContain('Memory leak detection');
      expect(persona.expertise).toContain('API call batching');
      expect(persona.expertise).toContain('Debouncing and throttling');
      expect(persona.focus).toContain('Event loop congestion');
      expect(persona.focus).toContain('Memory leaks');
      expect(persona.useCases.length).toBeGreaterThan(0);
    });

    test('all personas have non-empty descriptions', () => {
      const personas = getAllPersonas();
      personas.forEach((persona) => {
        expect(persona.description).toBeTruthy();
        expect(persona.description.length).toBeGreaterThan(10);
      });
    });

    test('all personas have at least one use case', () => {
      const personas = getAllPersonas();
      personas.forEach((persona) => {
        expect(persona.useCases.length).toBeGreaterThan(0);
      });
    });

    test('all personas have at least two expertise areas', () => {
      const personas = getAllPersonas();
      personas.forEach((persona) => {
        expect(persona.expertise.length).toBeGreaterThanOrEqual(2);
      });
    });

    test('all personas have at least two focus areas', () => {
      const personas = getAllPersonas();
      personas.forEach((persona) => {
        expect(persona.focus.length).toBeGreaterThanOrEqual(2);
      });
    });
  });
});
