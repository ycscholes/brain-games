import {
  BIRD_COUNT_TOTAL_QUESTIONS,
  createBirdCountOptions,
  createBirdCountQuestion,
  createBirdCountSession,
  getBirdCountRevealMs,
  getBirdCountTarget,
  getPetCountTotal,
  PET_COUNT_MOODS,
  PET_COUNT_SKINS,
  scoreBirdCountQuestion,
} from "../../src/pages/bird-count/gameLogic";

describe("bird-count game logic", () => {
  test("creates 8-question normal and hard sessions", () => {
    expect(createBirdCountSession("normal")).toHaveLength(BIRD_COUNT_TOTAL_QUESTIONS);
    expect(createBirdCountSession("hard")).toHaveLength(BIRD_COUNT_TOTAL_QUESTIONS);
  });

  test("pet count skin pool includes gecko and turtle", () => {
    expect(PET_COUNT_SKINS).toEqual(["cat", "dog", "rabbit", "bear", "panda", "gecko", "turtle"]);
  });

  test("uses a provided pet skin pool for target and decoy pets", () => {
    const question = createBirdCountQuestion("normal", 0, ["dog", "rabbit"]);
    const usedSkins = new Set(question.pets.map((pet) => pet.skin));

    expect(["dog", "rabbit"]).toContain(question.targetSkin);
    usedSkins.forEach((skin) => {
      expect(["dog", "rabbit"]).toContain(skin);
    });
  });

  test("falls back to the full pet pool when a provided pool is empty", () => {
    const question = createBirdCountQuestion("normal", 0, []);

    expect(PET_COUNT_SKINS).toContain(question.targetSkin);
    expect(question.pets).toHaveLength(question.totalPets);
  });

  test("normal questions use target pets, decoys, and slower reveal timing", () => {
    createBirdCountSession("normal").forEach((question, index) => {
      expect(question.answer).toBe(getBirdCountTarget("normal", index));
      expect(question.totalPets).toBe(getPetCountTotal("normal", index));
      expect(question.pets).toHaveLength(question.totalPets);
      expect(question.pets.filter((pet) => pet.skin === question.targetSkin)).toHaveLength(question.answer);
      expect(PET_COUNT_SKINS).toContain(question.targetSkin);
      expect(question.answer).toBeGreaterThanOrEqual(3);
      expect(question.answer).toBeLessThanOrEqual(7);
      expect(question.revealMs).toBe(getBirdCountRevealMs("normal", index));
      expect(question.revealMs).toBeGreaterThanOrEqual(2350);
    });
  });

  test("hard questions use more mixed pets and faster reveal timing", () => {
    createBirdCountSession("hard").forEach((question, index) => {
      expect(question.answer).toBe(getBirdCountTarget("hard", index));
      expect(question.totalPets).toBe(getPetCountTotal("hard", index));
      expect(question.pets).toHaveLength(question.totalPets);
      expect(question.pets.filter((pet) => pet.skin === question.targetSkin)).toHaveLength(question.answer);
      expect(question.answer).toBeGreaterThanOrEqual(5);
      expect(question.answer).toBeLessThanOrEqual(9);
      expect(question.laneCount).toBe(4);
      expect(question.revealMs).toBe(getBirdCountRevealMs("hard", index));
      expect(question.revealMs).toBeLessThanOrEqual(2800);
    });
  });

  test("generated pets have unique ids and bounded scroll positions", () => {
    const question = createBirdCountQuestion("hard", 7);
    const ids = new Set(question.pets.map((pet) => pet.id));

    expect(ids.size).toBe(question.pets.length);
    question.pets.forEach((pet) => {
      expect(PET_COUNT_SKINS).toContain(pet.skin);
      expect(pet.x).toBeGreaterThanOrEqual(0);
      expect(pet.x).toBeLessThanOrEqual(100);
      expect(pet.y).toBeGreaterThanOrEqual(58);
      expect(pet.y).toBeLessThanOrEqual(86);
      expect(pet.lane).toBeGreaterThanOrEqual(0);
      expect(pet.lane).toBeLessThan(question.laneCount);
    });
  });

  test("generated pets are distributed through the full farm strip", () => {
    const question = createBirdCountQuestion("hard", 7);
    const xs = question.pets.map((pet) => pet.x);
    const firstHalfCount = xs.filter((x) => x < 50).length;
    const secondHalfCount = xs.filter((x) => x >= 50).length;

    expect(Math.min(...xs)).toBeLessThanOrEqual(10);
    expect(Math.max(...xs)).toBeGreaterThanOrEqual(90);
    expect(firstHalfCount).toBeGreaterThan(0);
    expect(secondHalfCount).toBeGreaterThan(0);
    expect(Math.abs(firstHalfCount - secondHalfCount)).toBeLessThanOrEqual(1);
  });

  test("generated pets use valid stable moods without changing target counts", () => {
    createBirdCountSession("hard").forEach((question) => {
      question.pets.forEach((pet) => {
        expect(PET_COUNT_MOODS).toContain(pet.mood);
      });

      expect(question.pets.filter((pet) => pet.skin === question.targetSkin)).toHaveLength(question.answer);
    });
  });

  test("options include the correct answer once", () => {
    for (let answer = 4; answer <= 12; answer += 1) {
      const options = createBirdCountOptions(answer);

      expect(options).toHaveLength(4);
      expect(new Set(options).size).toBe(4);
      expect(options.filter((option) => option === answer)).toHaveLength(1);
    }
  });

  test("scores correct answers with speed and combo bonuses", () => {
    expect(scoreBirdCountQuestion({
      selectedAnswer: 8,
      correctAnswer: 8,
      answerMs: 1000,
      currentCombo: 2,
    })).toEqual({
      correct: true,
      speedBonus: 1,
      comboBonus: 1,
      score: 6,
    });

    expect(scoreBirdCountQuestion({
      selectedAnswer: 7,
      correctAnswer: 8,
      answerMs: 1000,
      currentCombo: 4,
    })).toEqual({
      correct: false,
      speedBonus: 0,
      comboBonus: 0,
      score: 0,
    });
  });
});
