'use strict';

const RESEARCH_RECOMMENDATIONS = {
  ETHICS: 'ETIK',
  NO_ETHICS: 'TANPA ETIK',
};

const ETHICS_RECOMMENDATIONS = {
  EXEMPTED: 'EXEMPTED',
  NOT_EXEMPTED: 'NOT EXEMPTED',
};

const isYes = (value) => value === 'yes';

const isNo = (value) => value === 'no';

const recommendResearch = (answers = {}) => {
  const questions = [
    answers.question1,
    answers.question2,
    answers.question3,
    answers.question4,
  ];

  const hasYesAnswer = questions.some(isYes);

  return hasYesAnswer
    ? RESEARCH_RECOMMENDATIONS.ETHICS
    : RESEARCH_RECOMMENDATIONS.NO_ETHICS;
};

const recommendEthics = (answers = {}) => {
  const q1 = answers.question1;
  const q2 = answers.question2;
  const q3 = answers.question3;
  const q4 = answers.question4;
  const q5 = answers.question5;
  const q6 = answers.question6;

  const q2ToQ6 = [q2, q3, q4, q5, q6];

  const allQ2ToQ6No = q2ToQ6.every(isNo);

  if (isYes(q1) && allQ2ToQ6No) {
    return ETHICS_RECOMMENDATIONS.EXEMPTED;
  }

  return ETHICS_RECOMMENDATIONS.NOT_EXEMPTED;
};

const recommend = (screeningType, answers) => {
  switch (screeningType) {
    case 'RESEARCH':
      return recommendResearch(answers);

    case 'ETHICS':
      return recommendEthics(answers);

    default:
      throw new Error(
        `Unsupported screening type: ${screeningType}`
      );
  }
};

module.exports = {
  RESEARCH_RECOMMENDATIONS,
  ETHICS_RECOMMENDATIONS,
  recommendResearch,
  recommendEthics,
  recommend,
};