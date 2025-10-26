/**
 * Dial Pad Component
 *
 * Purpose: DTMF dial pad for sending tones during active call
 *
 * Features:
 * - Standard phone keypad layout
 * - Send DTMF tones
 * - Visual feedback
 */

function DialPad({ onDigitPress }) {
  const buttons = [
    { digit: '1', letters: '' },
    { digit: '2', letters: 'ABC' },
    { digit: '3', letters: 'DEF' },
    { digit: '4', letters: 'GHI' },
    { digit: '5', letters: 'JKL' },
    { digit: '6', letters: 'MNO' },
    { digit: '7', letters: 'PQRS' },
    { digit: '8', letters: 'TUV' },
    { digit: '9', letters: 'WXYZ' },
    { digit: '*', letters: '' },
    { digit: '0', letters: '+' },
    { digit: '#', letters: '' },
  ];

  const handlePress = (digit) => {
    onDigitPress(digit);
  };

  return (
    <div className="grid grid-cols-3 gap-2">
      {buttons.map(({ digit, letters }) => (
        <button
          key={digit}
          onClick={() => handlePress(digit)}
          className="flex flex-col items-center justify-center h-14 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-all active:scale-95"
        >
          <span className="text-xl font-semibold text-gray-900 dark:text-white">
            {digit}
          </span>
          {letters && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {letters}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export default DialPad;
