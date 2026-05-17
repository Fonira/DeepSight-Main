// Déclarations ambient globales — débloquent `process.env.NODE_ENV` qui est
// remplacé par DefinePlugin de webpack en build, et toléré comme globale en
// runtime via le polyfill webextension.
declare const process: {
  env: {
    NODE_ENV?: string;
    [key: string]: string | undefined;
  };
};
