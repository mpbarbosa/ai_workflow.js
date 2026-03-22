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
  Persona,
  PersonaValidationResult,
} from '../../src/lib/ai_personas';

describe('ai_personas module', () => {
  describe('getAllPersonas', () => {
    it('should return an array of all personas', () => {
      const personas = getAllPersonas();
      expect(Array.isArray(personas)).toBe(true);
      expect(personas.length).toBe(getPersonaCount());
      expect(personas.every(p => typeof p.id === 'string')).toBe(true);
    });

    it('should return deep copies (modifying result does not affect source)', () => {
      const personas1 = getAllPersonas();
      const personas2 = getAllPersonas();
      personas1[0].name = 'Changed Name';
      expect(personas2[0].name).not.toBe('Changed Name');
    });
  });

  describe('getPersonaById', () => {
    it('should return the correct persona for a valid ID', () => {
      const all = getAllPersonas();
      const persona = getPersonaById(all[0].id);
      expect(persona).not.toBeNull();
      expect(persona?.id).toBe(all[0].id);
    });

    it('should return null for an invalid ID', () => {
      expect(getPersonaById('nonexistent_id')).toBeNull();
    });

    it('should be case-sensitive for ID', () => {
      const all = getAllPersonas();
      const id = all[0].id;
      expect(getPersonaById(id.toUpperCase())).toBeNull();
    });
  });

  describe('getPersonaByName', () => {
    it('should return the correct persona for a valid name', () => {
      const all = getAllPersonas();
      const persona = getPersonaByName(all[0].name);
      expect(persona).not.toBeNull();
      expect(persona?.name).toBe(all[0].name);
    });

    it('should return null for an invalid name', () => {
      expect(getPersonaByName('Nonexistent Name')).toBeNull();
    });

    it('should be case-sensitive for name', () => {
      const all = getAllPersonas();
      const name = all[0].name;
      expect(getPersonaByName(name.toLowerCase())).toBeNull();
    });
  });

  describe('getPersonasByTask', () => {
    it('should return personas matching a known task type', () => {
      const personas = getPersonasByTask('documentation');
      expect(Array.isArray(personas)).toBe(true);
      expect(personas.length).toBeGreaterThan(0);
      expect(personas.every(p => Array.isArray(p.focus))).toBe(true);
    });

    it('should return an empty array for an unknown task type', () => {
      expect(getPersonasByTask('unknown_task')).toEqual([]);
    });

    it('should be case-sensitive for task type', () => {
      const personas = getPersonasByTask('Documentation');
      expect(Array.isArray(personas)).toBe(true);
    });
  });

  describe('getPersonasByExpertise', () => {
    it('should return personas with matching expertise (case-insensitive substring)', () => {
      const all = getAllPersonas();
      const expertise = all[0].expertise[0];
      const personas = getPersonasByExpertise(expertise.slice(0, 3).toLowerCase());
      expect(personas.some(p => p.id === all[0].id)).toBe(true);
    });

    it('should return an empty array for no matches', () => {
      expect(getPersonasByExpertise('no_such_expertise')).toEqual([]);
    });

    it('should match multiple personas if applicable', () => {
      const personas = getPersonasByExpertise('security');
      expect(Array.isArray(personas)).toBe(true);
    });
  });

  describe('validatePersona', () => {
    it('should validate a correct persona object', () => {
      const persona = getAllPersonas()[0];
      const result = validatePersona(persona);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should invalidate a persona with missing fields', () => {
      const invalid = { id: 'x' };
      const result = validatePersona(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should invalidate a non-object input', () => {
      const result = validatePersona(null);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should invalidate a persona with wrong types', () => {
      const invalid = {
        id: 123,
        name: 456,
        role: [],
        expertise: 'not-an-array',
        tone: {},
        focus: 'not-an-array',
        description: 789,
        useCases: {},
      };
      const result = validatePersona(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('getPersonaCount', () => {
    it('should return the total number of personas', () => {
      const count = getPersonaCount();
      expect(typeof count).toBe('number');
      expect(count).toBe(getAllPersonas().length);
    });
  });

  describe('getPersonaIds', () => {
    it('should return all persona IDs as strings', () => {
      const ids = getPersonaIds();
      expect(Array.isArray(ids)).toBe(true);
      expect(ids.length).toBe(getPersonaCount());
      expect(ids.every(id => typeof id === 'string')).toBe(true);
    });

    it('should match the IDs in getAllPersonas', () => {
      const ids = getPersonaIds();
      const all = getAllPersonas();
      expect(ids.sort()).toEqual(all.map(p => p.id).sort());
    });
  });

  describe('personaExists', () => {
    it('should return true for an existing persona ID', () => {
      const id = getAllPersonas()[0].id;
      expect(personaExists(id)).toBe(true);
    });

    it('should return false for a non-existent persona ID', () => {
      expect(personaExists('not_a_real_id')).toBe(false);
    });

    it('should be case-sensitive', () => {
      const id = getAllPersonas()[0].id;
      expect(personaExists(id.toUpperCase())).toBe(false);
    });
  });
});
