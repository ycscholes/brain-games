const { validateRules } = require('../project_rules_validator');

describe('Project Rules Validator', () => {
  describe('no-explicit-any', () => {
    test('should fail when using : any', () => {
      const code = 'const x: any = 1;';
      expect(validateRules(code, 'no-explicit-any')).toBe(false);
    });

    test('should fail when using as any', () => {
      const code = 'const x = {} as any;';
      expect(validateRules(code, 'no-explicit-any')).toBe(false);
    });

    test('should pass when any is in a comment', () => {
      const code = '// this is any comment\nconst x: number = 1;';
      expect(validateRules(code, 'no-explicit-any')).toBe(true);
    });
  });

  describe('async-try-catch', () => {
    test('should fail when using await without try', () => {
      const code = 'async function test() { await Taro.request(); }';
      expect(validateRules(code, 'async-try-catch')).toBe(false);
    });

    test('should pass when using await with try', () => {
      const code = 'async function test() { try { await Taro.request(); } catch(e) {} }';
      expect(validateRules(code, 'async-try-catch')).toBe(true);
    });
  });

  describe('no-magic-numbers', () => {
    test('should fail for magic numbers like 2000', () => {
      const code = 'const timeout = 2000;';
      expect(validateRules(code, 'no-magic-numbers')).toBe(false);
    });

    test('should pass for 0, 1, -1', () => {
      const code = 'const x = 0; const y = 1; const z = -1;';
      expect(validateRules(code, 'no-magic-numbers')).toBe(true);
    });

    test('should pass for CSS units', () => {
      const code = 'const style = "width: 100px; height: 20rpx;";';
      expect(validateRules(code, 'no-magic-numbers')).toBe(true);
    });
  });

  describe('use-load-instead-of-effect', () => {
    test('should fail when using useEffect without useLoad in same file', () => {
      const code = 'useEffect(() => {}, [])';
      expect(validateRules(code, 'use-load-instead-of-effect')).toBe(false);
    });

    test('should pass when using both', () => {
      const code = 'useLoad(() => {}); useEffect(() => {}, [])';
      expect(validateRules(code, 'use-load-instead-of-effect')).toBe(true);
    });
  });
});
