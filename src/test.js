function test(count){
  return new Promise((resolve, reject)=>{
    if (count > 0) {
      console.log('>0');
      resolve(count)
    }else {
      console.log('=0');
      reject(count)
    }
  })
}

test(5).then(
  data=>console.log('success'),
  err=>console.log('fail')
).catch(reason=>console.log('reject', reason))


test(5).then(
  function(data){
    console.log('sucess');
  },
  function(err){
    console.log('fail');
  }
).catch(reason=>console.log('reject', reason))

// count = -1;
//
// if (count > 0) {
//   console.log('>0');
//   // test(count).catch(reason=>console.log('it may have some i dont understand things happen :)', reason))
// }else if(count < 0){
//   console.log('< 0');
// }else {
//   console.log('=0');
// }
