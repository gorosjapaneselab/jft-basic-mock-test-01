// Add or change student fields here. Stored legacy student.id is intentionally ignored.
export const STUDENT_FIELDS = Object.freeze([
  {key:'name',label:'Name',required:true,maxLength:120,autocomplete:'name'},
  {key:'className',label:'Class / Section',required:true,maxLength:120,autocomplete:'off'}
]);
export const PART_NAMES = ['Script & Vocabulary','Conversation & Expression','Listening','Reading'];
export const RESULT_TIME_ZONE = 'Asia/Taipei';
