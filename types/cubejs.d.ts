declare module "cubejs" {
  export interface CubeInstance {
    move(algorithm: string): CubeInstance;
    solve(): string;
    asString(): string;
    identity(): void;
  }

  export interface CubeConstructor {
    new (): CubeInstance;
    fromString(facelets: string): CubeInstance;
    initSolver(): void;
    inverse(algorithm: string): string;
  }

  const Cube: CubeConstructor;
  export default Cube;
}
