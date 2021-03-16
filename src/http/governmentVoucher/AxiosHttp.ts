import axios from "axios";

const Axioshttp = axios.create({
    baseURL: process.env.VOUCHER_URL
});
Axioshttp.defaults.timeout = 3000000;
Axioshttp.interceptors.request.use(function (config) {
    return config;
});

export default Axioshttp;