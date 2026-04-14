/**
 * @fileoverview AI Personas Module - AI persona definitions and management
 * @module lib/ai_personas
 * @version 2.0.0
 * @description
 * Defines 17 specialized AI personas for workflow automation.
 * Each persona has specific expertise, tone, and focus areas.
 *
 * Architecture: Pure functions only (persona data is immutable)
 * - No side effects
 * - Deterministic persona retrieval
 * - Immutable persona definitions
 *
 * Part of: Tests & Documentation Workflow Automation (JavaScript/Node.js)
 * Migrated from: src/workflow/lib/ai_personas.sh + .workflow_core/config/ai_helpers.yaml
 */
/** A single AI persona definition. */
export interface Persona {
    /** Unique identifier for the persona. */
    id: string;
    /** Display name. */
    name: string;
    /** Primary role description. */
    role: string;
    /** Areas of expertise. */
    expertise: string[];
    /** Communication tone. */
    tone: string;
    /** Key focus areas. */
    focus: string[];
    /** Detailed description. */
    description: string;
    /** Common use cases. */
    useCases: string[];
}
/** Result returned by {@link validatePersona}. */
export interface PersonaValidationResult {
    valid: boolean;
    errors: string[];
}
/**
 * Get all available personas.
 * @pure
 * @returns Array of all personas (deep copies).
 * @example
 * const personas = getAllPersonas();
 * // Returns array of 17 personas
 */
export declare function getAllPersonas(): Persona[];
/**
 * Get persona by ID.
 * @pure
 * @param id - Persona ID.
 * @returns Persona object or `null` if not found.
 * @example
 * const persona = getPersonaById('documentation_expert');
 * // Returns Documentation Expert persona
 */
export declare function getPersonaById(id: string): Persona | null;
/**
 * Get persona by name.
 * @pure
 * @param name - Persona display name.
 * @returns Persona object or `null` if not found.
 * @example
 * const persona = getPersonaByName('Documentation Expert');
 * // Returns Documentation Expert persona
 */
export declare function getPersonaByName(name: string): Persona | null;
/**
 * Get personas by task type.
 * @pure
 * @param taskType - Task type (e.g., `'documentation'`, `'testing'`, `'security'`).
 * @returns Array of matching personas.
 * @example
 * const personas = getPersonasByTask('documentation');
 * // Returns [Documentation Expert, Technical Writer]
 */
export declare function getPersonasByTask(taskType: string): Persona[];
/**
 * Get personas by expertise area.
 * @pure
 * @param expertiseArea - Expertise area to search for (case-insensitive substring match).
 * @returns Array of personas with matching expertise.
 * @example
 * const personas = getPersonasByExpertise('Security');
 * // Returns [Security Expert, Dependency Analyst]
 */
export declare function getPersonasByExpertise(expertiseArea: string): Persona[];
/**
 * Validate a persona object structure.
 * @pure
 * @param persona - Value to validate (accepts `unknown` for type-safe checking).
 * @returns Validation result with `valid` flag and array of error messages.
 * @example
 * const result = validatePersona(myPersona);
 * // { valid: true, errors: [] }
 */
export declare function validatePersona(persona: unknown): PersonaValidationResult;
/**
 * Get the total number of available personas.
 * @pure
 * @returns Total persona count.
 * @example
 * const count = getPersonaCount(); // 17
 */
export declare function getPersonaCount(): number;
/**
 * Get all persona IDs.
 * @pure
 * @returns Array of persona ID strings.
 * @example
 * const ids = getPersonaIds();
 * // ['documentation_expert', 'technical_writer', ...]
 */
export declare function getPersonaIds(): string[];
/**
 * Check whether a persona with the given ID exists.
 * @pure
 * @param id - Persona ID.
 * @returns `true` if the persona exists.
 * @example
 * const exists = personaExists('documentation_expert'); // true
 */
export declare function personaExists(id: string): boolean;
//# sourceMappingURL=ai_personas.d.ts.map