export interface ILoginFormState {
  username: string;
  password: string;
}

export interface ILoginFormErrors {
  username?: string;
  password?: string;
  general?: string;
}
