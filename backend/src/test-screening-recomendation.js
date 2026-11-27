const {
    recommendResearch,
    recommendEthics,
  } = require('../src/services/screening_recommendation.service');
  
  console.log('=== RESEARCH ===');
  
  console.log(
    'Semua false:',
    recommendResearch({
      question1: false,
      question2: false,
      question3: false,
      question4: false,
    })
  );
  
  console.log(
    'Ada true:',
    recommendResearch({
      question1:false,
      question2:true,
      question3:false,
      question4:false,
    })
  );
  
  console.log('\n=== ETHICS ===');
  
  console.log(
    'Q1 true, Q2-Q6 false:',
    recommendEthics({
      question1: true,
      question2: false,
      question3: false,
      question4: false,
      question5: false,
      question6: false,
    })
  );
  
  console.log(
    'Q1 false, ada Q2-Q6 true:',
    recommendEthics({
      question1: false,
      question2: true,
      question3: true,
      question4: true,
      question5: true,
      question6: true,
    })
  );
  
  console.log(
    'Q1 false, semua Q2-Q6 false:',
    recommendEthics({
      question1: false,
      question2: false,
      question3: false,
      question4: false,
      question5: false,
      question6: false,
    })
  );
  
  console.log(
    'Q1 true, ada Q2-Q6 true:',
    recommendEthics({
      question1: true,
      question2: true,
      question3: true,
      question4: true,
      question5: true,
      question6: true,
    })
  );