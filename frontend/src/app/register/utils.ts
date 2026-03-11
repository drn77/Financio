import { IRegisterFormState, IRegisterFormErrors } from './model';
import { Resources } from './resources';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;

export const validateRegisterForm = (state: IRegisterFormState): IRegisterFormErrors => {
  const errors: IRegisterFormErrors = {};

  if (!state.username.trim()) {
    errors.username = Resources.validation.usernameRequired;
  } else if (state.username.trim().length < 3) {
    errors.username = Resources.validation.usernameMinLength;
  } else if (!USERNAME_REGEX.test(state.username)) {
    errors.username = Resources.validation.usernamePattern;
  }

  if (!state.email.trim()) {
    errors.email = Resources.validation.emailRequired;
  } else if (!EMAIL_REGEX.test(state.email)) {
    errors.email = Resources.validation.emailInvalid;
  }

  if (!state.password) {
    errors.password = Resources.validation.passwordRequired;
  } else if (state.password.length < 8) {
    errors.password = Resources.validation.passwordMinLength;
  }

  if (!state.confirmPassword) {
    errors.confirmPassword = Resources.validation.confirmPasswordRequired;
  } else if (state.password !== state.confirmPassword) {
    errors.confirmPassword = Resources.validation.confirmPasswordMismatch;
  }

  return errors;
};
