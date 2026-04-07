module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/tests", "<rootDir>/.trae/rules/tests"],
  transform: {
    "^.+\\.(t|j)sx?$": "babel-jest",
  },
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
};
