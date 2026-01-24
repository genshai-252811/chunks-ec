/**
 * Sentence Bank - Vietnamese sentences for English practice
 */

export interface Sentence {
  id: string;
  vietnamese: string;
  english: string;
  category: 'greeting' | 'daily' | 'business' | 'expression' | 'question' | 'vocab' | 'slang';
}

export const sentences: Sentence[] = [
  // Greetings
  {
    id: '1',
    vietnamese: 'Tôi rất vui được gặp bạn',
    english: 'I am very happy to meet you',
    category: 'greeting',
  },
  {
    id: '2',
    vietnamese: 'Chào buổi sáng! Hôm nay bạn thế nào?',
    english: 'Good morning! How are you today?',
    category: 'greeting',
  },
  {
    id: '3',
    vietnamese: 'Cảm ơn bạn rất nhiều',
    english: 'Thank you very much',
    category: 'greeting',
  },

  // Daily Life
  {
    id: '4',
    vietnamese: 'Hôm nay là một ngày tuyệt vời',
    english: 'Today is a wonderful day',
    category: 'daily',
  },
  {
    id: '5',
    vietnamese: 'Tôi đang học tiếng Anh mỗi ngày',
    english: 'I am learning English every day',
    category: 'daily',
  },
  {
    id: '6',
    vietnamese: 'Thời tiết hôm nay rất đẹp',
    english: 'The weather is beautiful today',
    category: 'daily',
  },
  {
    id: '7',
    vietnamese: 'Tôi thích uống cà phê vào buổi sáng',
    english: 'I like drinking coffee in the morning',
    category: 'daily',
  },

  // Business / Professional
  {
    id: '8',
    vietnamese: 'Tôi có thể giúp gì cho bạn?',
    english: 'How can I help you?',
    category: 'business',
  },
  {
    id: '9',
    vietnamese: 'Chúng tôi sẽ liên hệ lại với bạn sớm',
    english: 'We will contact you soon',
    category: 'business',
  },
  {
    id: '10',
    vietnamese: 'Xin lỗi, bạn có thể nhắc lại được không?',
    english: 'Sorry, could you repeat that please?',
    category: 'business',
  },
  {
    id: '11',
    vietnamese: 'Tôi hiểu ý bạn rồi',
    english: 'I understand what you mean',
    category: 'business',
  },

  // Expressions
  {
    id: '12',
    vietnamese: 'Đừng lo lắng, mọi thứ sẽ ổn thôi',
    english: "Don't worry, everything will be fine",
    category: 'expression',
  },
  {
    id: '13',
    vietnamese: 'Tôi tin bạn có thể làm được',
    english: 'I believe you can do it',
    category: 'expression',
  },
  {
    id: '14',
    vietnamese: 'Chúng ta hãy bắt đầu ngay bây giờ',
    english: "Let's start right now",
    category: 'expression',
  },
  {
    id: '15',
    vietnamese: 'Đây là cơ hội tuyệt vời',
    english: 'This is a great opportunity',
    category: 'expression',
  },

  // Questions
  {
    id: '16',
    vietnamese: 'Bạn đến từ đâu?',
    english: 'Where are you from?',
    category: 'question',
  },
  {
    id: '17',
    vietnamese: 'Bạn làm nghề gì?',
    english: 'What do you do for a living?',
    category: 'question',
  },
  {
    id: '18',
    vietnamese: 'Bạn có thể giải thích thêm được không?',
    english: 'Could you explain more?',
    category: 'question',
  },
  {
    id: '19',
    vietnamese: 'Khi nào chúng ta gặp nhau?',
    english: 'When shall we meet?',
    category: 'question',
  },
  {
    id: '20',
    vietnamese: 'Bạn nghĩ sao về điều này?',
    english: 'What do you think about this?',
    category: 'question',
  },

  // More expressions
  {
    id: '21',
    vietnamese: 'Tôi rất hào hứng về dự án này',
    english: 'I am very excited about this project',
    category: 'expression',
  },
  {
    id: '22',
    vietnamese: 'Hãy làm việc cùng nhau',
    english: "Let's work together",
    category: 'expression',
  },
  {
    id: '23',
    vietnamese: 'Tôi đồng ý với bạn hoàn toàn',
    english: 'I completely agree with you',
    category: 'expression',
  },
  {
    id: '24',
    vietnamese: 'Chúng ta có thể thảo luận về điều này',
    english: 'We can discuss this',
    category: 'business',
  },
  {
    id: '25',
    vietnamese: 'Cảm ơn vì đã lắng nghe',
    english: 'Thank you for listening',
    category: 'greeting',
  },
];

/**
 * Get a random sentence from the bank
 */
export const getRandomSentence = (): Sentence => {
  const index = Math.floor(Math.random() * sentences.length);
  return sentences[index];
};

/**
 * Get a random sentence excluding a specific ID
 */
export const getNextRandomSentence = (excludeId: string): Sentence => {
  const filtered = sentences.filter((s) => s.id !== excludeId);
  const index = Math.floor(Math.random() * filtered.length);
  return filtered[index];
};

/**
 * Get sentences by category
 */
export const getSentencesByCategory = (category: Sentence['category']): Sentence[] => {
  return sentences.filter((s) => s.category === category);
};
