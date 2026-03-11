import { ILoginFormState, ILoginFormErrors } from './model';
import { Resources } from './resources';

export const validateLoginForm = (state: ILoginFormState): ILoginFormErrors => {
  const errors: ILoginFormErrors = {};

  if (!state.username.trim()) {
    errors.username = Resources.validation.usernameRequired;
  }

  if (!state.password) {
    errors.password = Resources.validation.passwordRequired;
  }

  return errors;
};
