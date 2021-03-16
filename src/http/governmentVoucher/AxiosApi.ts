// import userHttp from './userHttp';
import AxiosHttp from "./AxiosHttp";


let AxiosHttpApi = {
  checkBalance(body) {
    let url = '/checkBalance'
    return Method.dataPost(url, body);
  },
  redeem(body) {
    let url = '/redeem';
    return Method.dataPost(url, body);
  }
}

export const VoucherStatus = {
  SUCCESS: 1,
  FAIL: 7,

  UNKNOWN_RESPONSE: 3,
  UNKNOWN_BLANK_RESPONSE: 4,

  UNKNOWN: 5,

  INTERNAL_ERROR_NO_RESPONSE: 8,

  UNAVAILABLE: 9,
  RATE_LIMIT: 10,
}

let Method = {
  async dataPost(newurl, body): Promise<{ status: number; result: any | string; }> {
    const url = newurl;
    return await new Promise((resolve, reject) => {
      AxiosHttp
        .post(url, body, {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*" ,
            "x-api-key": process.env.VOUCHER_API_KEY
          }
        })
        .then(result => {
          switch (result.status) {
            case 200:
              return resolve({
                status: VoucherStatus.SUCCESS,
                result: result.data
              });
            default:
              if (result) {
                return reject({
                  status: VoucherStatus.UNKNOWN_RESPONSE,
                  error: VoucherStatus.UNKNOWN_RESPONSE,
                  message: result.data.message,
                });
              }
              // NO RESULT
              return reject({
                status: VoucherStatus.UNKNOWN_BLANK_RESPONSE,
                error: VoucherStatus.UNKNOWN_BLANK_RESPONSE,
                message: "Something went wrong."
              });
          }
        })
        .catch(err => {
          if (err.response) {
            if (err.response.status !== null && err.response.status !== undefined) {
              switch (err.response.status) {
                case 400:
                  console.log("inside --- 400:::" + JSON.stringify(err.response.data));
                  return reject({status: VoucherStatus.FAIL, error: err, message: err.response.data.message})
                case 429:
                  return reject({
                    status: VoucherStatus.RATE_LIMIT,
                    result: err.response.data,
                    message: err.response.data.message
                  });
                case 503:
                  return reject({
                    status: VoucherStatus.UNAVAILABLE,
                    result: err.response.data,
                    message: err.response.data.message
                  });
                default:
                  console.log("ESLE - 1 : ")
                  console.log("Error::::: " + err.response.headers)
                  console.log("Error::::: " + err.response.data)
                  console.log("Error::::: " + err.response.status)
                  return reject({
                    status: VoucherStatus.UNKNOWN,
                    error: err,
                    message: err.response.data
                  })
              }
            }
          }
          else {
            console.log("ESLE - 2 : ")
            return reject({
              status: VoucherStatus.INTERNAL_ERROR_NO_RESPONSE,
              error: err,
              message: err.message
            });
          }
        });
    });
  },



  // Method to GET response

  async dataGet(newurl) {
    const url = newurl;
    return await new Promise((resolve, reject) => {
      AxiosHttp
        .get(url, {
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        })

        .then(result => {
          if (result.status === 200) {
            return resolve({
              status: 1,
              result: result
            });
          }
          else if (result.status == 212) {
            return resolve({
              status: 4,
              result: result
            });
          }
          else {
            if (result) {
              return reject({
                status: 3,
                error: result.data.message,
              });
            } else {
              return reject({
                status: 4,
                error: "Something went wrong."
              });
            }
          }
        })
        .catch(err => {
          console.log(err.response)
          if (err.response) {
            if (err.response.status !== null && err.response.status !== undefined) {
              if (err.response.status == 401) {
                let unauthorizedStatus = err.response.status
                if (unauthorizedStatus == 401) {
                }
              }
              else {
                return reject({
                  status: 5,
                  error: err
                })

              }
            }
          }
          else {
            return reject({
              status: 5,
              error: err
            });

          }
        });
    });
  },


};

export default AxiosHttpApi;
