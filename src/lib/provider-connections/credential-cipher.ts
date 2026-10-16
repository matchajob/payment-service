export type CredentialCipher = {
  seal: (plaintext: string) => Promise<string>;
  open: (sealed: string) => Promise<string>;
};
