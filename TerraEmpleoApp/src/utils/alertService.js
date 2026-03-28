let _ref = null;

export function setGlobalAlertRef(ref) {
  _ref = ref;
}

/**
 * Drop-in replacement for Alert.alert.
 * showAlert(title, message?, buttons?, type?)
 * type: 'success' | 'error' | 'warning' | 'info' | 'destructive' (auto-detected if omitted)
 */
export function showAlert(title, message = '', buttons = [{ text: 'OK' }], type) {
  if (_ref?.show) {
    _ref.show(title, message, buttons, type);
  }
}
