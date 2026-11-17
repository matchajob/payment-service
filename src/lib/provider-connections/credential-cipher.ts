export type CredentialCipher = {
  seal: (plaintext: string, connectionId: string) => Promise<string>;
  open: (sealed: string, connectionId: string) => Promise<string>;
};
