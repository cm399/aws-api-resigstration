import { isNullOrUndefined } from '../../utils/Utils';


const getTeamRegistrationInvoiceTemplate = (
    invoiceData
) => {
    let userDetail = invoiceData!= null ? invoiceData.billTo: null;
    let getAffiliteDetailData = getAffiliteDetailArray(invoiceData);
    let organisationLogo = invoiceData!= null ? invoiceData.organisationLogo : null;
    let data = invoiceData!= null ? invoiceData.compParticipants : []
    let total = invoiceData!= null ? invoiceData.total: null;
    let shopProducts = invoiceData!= null ? invoiceData.shopProducts : []
    let shopTotalAmount = 0;
    (shopProducts || []).map((x) =>{
        shopTotalAmount += x.totalAmt;
    })
    let isSchoolRegistrationApplied = 0;
    (data || []).map((item) =>{
        if(item.selectedOptions.isSchoolRegCodeApplied == 1){
            isSchoolRegistrationApplied = 1;
        }
    })
    
    return `
        <!doctype html>
        <html>
            <head>
                <meta charset="utf-8">
                <style>
                @media print {  
                    body {
                        width: 100%;
                        font-family: Arial
                     }
                    
                    .full-body
                    {
                        width: 100%;
                        max-width: 800px;
                        padding: 16px;
                        background-color: #FFFFFF;
                        box-sizing: border-box;
                    }
                    .header
                    {
                        display: -webkit-box;
                        display: -webkit-flex;
                        -webkit-flex-wrap: wrap;
                        display: flex;
                    }

                    table{
                        width:100%
                    }
                     .row {
                        width: 100%;
                        height: 10px;
                        display: -webkit-box;
                        display: -webkit-flex;
                        -webkit-flex-wrap: wrap;
                        display: flex;
                        flex-wrap: wrap;
                        flex-direction: row;
                     }
                     .cell {
                        width: 10%;
                        text-align: left;
                     }
                     .largeCell {
                        width: 50%;
                        text-align: left;
                     }
                     .input-heading-row {
                        font-size: 14px;
                        color: #4c4c6d;
                        font-weight: 500;
                     }
                     .input-heading-col {
                        font-size: 13px;
                        color: #4c4c6d;
                        font-weight: 500;
                     }

                    .mt-3
                    {
                        margin-top: 30px;
                    }
                    .bill-no
                    {
                        margin-top: 15px;
                    }
                    .outer-header
                    {
                        padding-left: 20px;
                    }
                    .bottom-divider
                    {
                        border-bottom: 1px solid rgba(0, 0, 0, 0.65);
                        padding-bottom: 15px;
                    }
                    .total-border
                    {
                        width: 210px;
                        border-bottom: 1px solid rgba(0, 0, 0, 0.65);
                        margin-left: auto;
                        padding-top: 16px;
                    }

                    .total{
                        justify-content:flex-end;
                        -webkit-justify-content:flex-end;
                    }
                    .subtotal-container{
                        flex-direction:column;
                        -webkit-flex-direction:column;
                        margin-top: 50px;
                    }
                    .mt-2{
                        margin-top: 20px;
                    }
                    .mt-1{
                        margin-top: 10px;
                    }
                    .pl-2{
                        padding-left: 20px;
                    }
                    .pr-3{
                        padding-right: 30px;
                    }
                    .pb-1{
                        padding-bottom: 10px;
                    }
                    .align-right{
                        text-align: right;
                    }
                    .inv-txt{
                        color: red;
                        font-size: 15px;
                    }
                }
                </style>
            </head>
            <body>
                <div class="full-body">
                <div class="outer-header">
                    <table>
                        <tr>
                            <td>
                                <div>
                                <img src=${organisationLogo ? organisationLogo : ""}
                                height="120" width="120" />
                               
                                </div>
                            </td>
                            <td>
                                ${getAffiliteDetailData.length > 0 ? getAffiliteDetailData.map((item,index) =>(
                                `<div class="pb-1">
                                    <div class="input-heading-row">${item.organisationName}</div>
                                    <div class="input-heading-row">E: <span class="input-heading-col">
                                                ${item.organiationEmailId!= null ? item.organiationEmailId:"N/A"}</span></div>
                                    <div class="input-heading-row">Ph: <span class="input-heading-col">
                                    ${item.organiationPhoneNo?item.organiationPhoneNo:"N/A"}</span></div>
                                </div>`
                                )).join('') : ''}
                            </td>
                        </tr>
                    </table>
                    <div class="mt-3">
                        <div class="input-heading-row">Receipt No.1234556   <span class="inv-txt">${isSchoolRegistrationApplied == 1 ? '(To be invoiced via school)' : "" } </span></div>
                        <div class="bill-no input-heading-row">Bill To: 
                            ${(userDetail && userDetail.firstName) ?  
                                `<span class="input-heading-col">
                                    ${userDetail.firstName + ' ' + (userDetail.middleName!= null ? userDetail.middleName : '') + ' ' + userDetail.lastName}
                                </span>`
                            : '' }
                        </div>
                        ${(userDetail && userDetail.street1) ? 
                        `<div class="input-heading-col">${userDetail.street1}</div>`
                         : '' }
                         ${(userDetail && userDetail.street2) ? 
                            `<div class="input-heading-col">${userDetail.street2}</div>`
                        : '' }
                        ${(userDetail) ? 
                            `<div class="input-heading-col">
                            ${userDetail.suburb +", " + userDetail.state + ", " + userDetail.postalCode}
                            </div>`
                        : '' }
                    </div>
                </div>
                <div class="row mt-3  input-heading-row">
                    <div class="largeCell">Description</div>
                    <div class="cell">Quality</div>
                    <div class="cell">Unit Price </div>
                    <div class="cell">Discount</div>
                    <div class="cell">GST</div>
                    <div class="cell">Amount AUD</div>
                </div>
                <div class="bottom-divider mt-1"></div>
                ${data && data.length > 0 ? data.map((item, index) => (
                `<div>
                    ${(item.membershipProducts || []).map((mem, memIndex) =>(
                        `<div>
                            <div class="header mt-3 bottom-divider input-heading-row">
                                ${mem.firstName!= null ? 
                                    `<div>
                                        ${item.divisionName!= null ? 
                                            (item.isTeamRegistration!= undefined && item.isTeamRegistration == 1 ? 'Team Registration' : 'Registration') 
                                                + " - " + (mem.membershipTypeName!= null ? mem.membershipTypeName : '')  
                                                + " " + mem.firstName + " " + mem.lastName
                                                + ", " + item.competitionName + " - " + item.divisionName
                                            : 
                                            (item.isTeamRegistration!= undefined && item.isTeamRegistration == 1 ? 'Team Registration' : 'Registration') 
                                                + " - " + (mem.membershipTypeName!= null ? mem.membershipTypeName : '')  
                                                + " " + mem.firstName + " " + mem.lastName
                                                + ", " + item.competitionName
                                        }
                                    </div>`
                                    : '' }
                                </div>
                                ${mem.fees.membershipFee!= null ? 
                                `<div class="header mt-3 bottom-divider input-heading-col">
                                    <div class="largeCell">${(mem.fees.membershipFee.name!= null ? mem.fees.membershipFee.name : '')  + " - " + (mem.membershipProductName!= null ? mem.membershipProductName : '') +  " - Membership Fees - " + 
                                                                (mem.membershipTypeName!= null ? mem.membershipTypeName : '')}</div>
                                    <div class="cell">1.00</div>
                                    <div class="cell">${(Number(mem.fees.membershipFee.feesToPay)).toFixed(2)}</div>
                                    <div class="cell">${(parseFloat((mem.fees.membershipFee.discountsToDeduct).toFixed(2)) + 
                                        parseFloat((mem.fees.membershipFee.childDiscountsToDeduct!= null ? mem.fees.membershipFee.childDiscountsToDeduct : 0).toFixed(2))).toFixed(2)}</div>
                                    <div class="cell">${(Number(mem.fees.membershipFee.feesToPayGST)).toFixed(2)}</div>
                                    <div class="cell">${(parseFloat((mem.fees.membershipFee.feesToPay).toFixed(2)) + parseFloat((mem.fees.membershipFee.feesToPayGST).toFixed(2) ) - parseFloat((mem.fees.membershipFee.discountsToDeduct).toFixed(2)) -
                                        parseFloat((mem.fees.membershipFee.childDiscountsToDeduct!= null ? mem.fees.membershipFee.childDiscountsToDeduct : 0).toFixed(2)) ).toFixed(2)}</div>
                                </div>`
                                : ''}
                                ${mem.fees.competitionOrganisorFee!= null ? 
                                `<div class="header mt-3 bottom-divider input-heading-col">
                                    <div class="largeCell">${mem.fees.competitionOrganisorFee.name + " - Competition Fees"}</div>
                                    <div class="cell">1.00</div>
                                    <div class="cell">${(Number(mem.fees.competitionOrganisorFee.feesToPay)).toFixed(2)}</div>
                                    <div class="cell">${(parseFloat((mem.fees.competitionOrganisorFee.discountsToDeduct).toFixed(2)) +
                                        parseFloat((mem.fees.competitionOrganisorFee.childDiscountsToDeduct!= null ? mem.fees.competitionOrganisorFee.childDiscountsToDeduct : 0).toFixed(2))).toFixed(2)}</div>
                                    <div class="cell">${(Number(mem.fees.competitionOrganisorFee.feesToPayGST)).toFixed(2)}</div>
                                    <div class="cell">${(  parseFloat((mem.fees.competitionOrganisorFee.feesToPay).toFixed(2)) + parseFloat((mem.fees.competitionOrganisorFee.feesToPayGST).toFixed(2)) - parseFloat((mem.fees.competitionOrganisorFee.discountsToDeduct).toFixed(2)) -
                                        parseFloat((mem.fees.competitionOrganisorFee.childDiscountsToDeduct!= null ? mem.fees.competitionOrganisorFee.childDiscountsToDeduct : 0).toFixed(2))).toFixed(2)}</div>
                                </div>`
                                : '' }
                                ${mem.fees.competitionOrganisorFee!= null && mem.fees.competitionOrganisorFee.nominationFeeToPay!= null && mem.fees.competitionOrganisorFee.nominationFeeToPay >= 1 ? 
                                    `<div class="header mt-3 bottom-divider input-heading-col">
                                        <div class="largeCell">${mem.fees.competitionOrganisorFee.name + " - Nomination Fees"}</div>
                                        <div class="cell">1.00</div>
                                        <div class="cell">${(Number(mem.fees.competitionOrganisorFee.nominationFeeToPay)).toFixed(2)}</div>
                                        <div class="cell">${(parseFloat((mem.fees.competitionOrganisorFee.discountsToDeduct).toFixed(2)) +
                                            parseFloat((mem.fees.competitionOrganisorFee.childDiscountsToDeduct!= null ? mem.fees.competitionOrganisorFee.childDiscountsToDeduct : 0).toFixed(2))).toFixed(2)}</div>
                                        <div class="cell">${(Number(mem.fees.competitionOrganisorFee.nominationGSTToPay)).toFixed(2)}</div>
                                        <div class="cell">${(  parseFloat((mem.fees.competitionOrganisorFee.nominationFeeToPay).toFixed(2)) + parseFloat((mem.fees.competitionOrganisorFee.nominationGSTToPay).toFixed(2)) - parseFloat((mem.fees.competitionOrganisorFee.discountsToDeduct).toFixed(2)) -
                                            parseFloat((mem.fees.competitionOrganisorFee.childDiscountsToDeduct!= null ? mem.fees.competitionOrganisorFee.childDiscountsToDeduct : 0).toFixed(2))).toFixed(2)}</div>
                                    </div>`
                                    : '' }
                                ${mem.fees.affiliateFee!= null ? 
                                    `<div class="header mt-3 bottom-divider input-heading-col">
                                        <div class="largeCell">${mem.fees.affiliateFee.name + " - Affiliate Fees"}</div>
                                        <div class="cell">1.00</div>
                                        <div class="cell">${(Number(mem.fees.affiliateFee.feesToPay)).toFixed(2)}</div>
                                        <div class="cell">${(parseFloat((mem.fees.affiliateFee.discountsToDeduct).toFixed(2)) + 
                                            parseFloat((mem.fees.affiliateFee.childDiscountsToDeduct!= null ? mem.fees.affiliateFee.childDiscountsToDeduct : 0).toFixed(2))).toFixed(2)}</div>
                                        <div class="cell">${(Number(mem.fees.affiliateFee.feesToPayGST)).toFixed(2)}</div>
                                        <div class="cell">${(parseFloat((mem.fees.affiliateFee.feesToPay).toFixed(2)) + parseFloat((mem.fees.affiliateFee.feesToPayGST).toFixed(2)) - parseFloat((mem.fees.affiliateFee.discountsToDeduct).toFixed(2)) - 
                                            parseFloat((mem.fees.affiliateFee.childDiscountsToDeduct!= null ? mem.fees.affiliateFee.childDiscountsToDeduct : 0).toFixed(2))).toFixed(2)}</div>
                                    </div>`
                                    : '' }
                                    ${mem.fees.affiliateFee!= null && mem.fees.affiliateFee.nominationFeeToPay!= null && mem.fees.affiliateFee.nominationFeeToPay >= 1 ? 
                                        `<div class="header mt-3 bottom-divider input-heading-col">
                                            <div class="largeCell">${mem.fees.affiliateFee.name + " - Nomination Fees"}</div>
                                            <div class="cell">1.00</div>
                                            <div class="cell">${(Number(mem.fees.affiliateFee.nominationFeeToPay)).toFixed(2)}</div>
                                            <div class="cell">${(parseFloat((mem.fees.affiliateFee.discountsToDeduct).toFixed(2)) +
                                                parseFloat((mem.fees.affiliateFee.childDiscountsToDeduct!= null ? mem.fees.affiliateFee.childDiscountsToDeduct : 0).toFixed(2))).toFixed(2)}</div>
                                            <div class="cell">${(Number(mem.fees.affiliateFee.nominationGSTToPay)).toFixed(2)}</div>
                                            <div class="cell">${(  parseFloat((mem.fees.affiliateFee.nominationFeeToPay).toFixed(2)) + parseFloat((mem.fees.affiliateFee.nominationGSTToPay).toFixed(2)) - parseFloat((mem.fees.affiliateFee.discountsToDeduct).toFixed(2)) -
                                                parseFloat((mem.fees.affiliateFee.childDiscountsToDeduct!= null ? mem.fees.affiliateFee.childDiscountsToDeduct : 0).toFixed(2))).toFixed(2)}</div>
                                        </div>`
                                        : '' }
                            <div>
                            <div class="header mt-3 total">
                                <div class="cell input-heading-row">Total</div>
                                <div class="cell input-heading-col">${"$" + (Number(mem.feesToPay) - Number(mem.discountsToDeduct) - Number(mem.childDiscountsToDeduct!= null ? mem.childDiscountsToDeduct : 0)).toFixed(2)}</div>
                            </div>
                        </div>`
                    )).join('') 
                    }
                </div>`
                )).join('') : '' }

                ${
                    (shopProducts || []).map((item, index) =>(
                        `<div>
                            <div class="header mt-3 bottom-divider input-heading-col">
                            <div class="largeCell">${item.organisationName + " - " + item.productName + " - " + item.variantName +'('+ item.optionName+')' + " - Shop Product Fees"}</div>
                            <div class="cell">${(Number(item.quantity)).toFixed(2)}</div>
                            <div class="cell">${(Number(item.amount)).toFixed(2)}</div>
                            <div class="cell">${"0.00"}</div>
                            <div class="cell">${(Number(item.tax)).toFixed(2)}</div>
                            <div class="cell">${(Number(item.totalAmt)).toFixed(2)}</div>
                            </div>
                            <div class="header mt-3 total">
                                <div class="cell input-heading-row">Total</div>
                                <div class="cell input-heading-col">${"$" + shopTotalAmount ? (shopTotalAmount).toFixed(2) : "N/A"}</div>
                            </div>
                        </div>`
                    )).join('') 
                }
                <div class="header total subtotal-container">
                    <div class="header total">
                        <div class="cell input-heading-row">Subtotal</div>
                        <div class="cell input-heading-col ">
                        $${total != null ? total.subTotal : '0.00'}
                        </div>
                    </div>
                    <div class="header total mt-1">
                        <div class="cell input-heading-row">GST</div>
                        <div class="cell input-heading-col ">$${total != null ?  total.gst : '0.00'}</div>
                    </div>
                    <div class="header total mt-1">
                        <div class="cell input-heading-row">Charity</div>
                        <div class="cell input-heading-col ">$${total != null ?  total.charityValue : '0.00'}</div>
                    </div>
                    <div class="total-border"></div>
                    <div class="header total mt-2">
                        <div class="cell input-heading-row">Total </div>
                        <div class="cell pl-2 pr-3 input-heading-col align-right">$${total != null ?  total.total : '0.00'}</div>
                    </div>
                    <div class="header total mt-2">
                        <div class="cell input-heading-row">Transaction Fee</div>
                        <div class="cell pl-2 pr-3 input-heading-col align-right">$${total != null ?  total.transactionFee : '0.00'}</div>
                    </div>
                    <div class="total-border"></div>
                    <div class="header total mt-2">
                        <div class="cell input-heading-row">Amount Paid </div>
                        <div class="cell pl-2 pr-3 input-heading-col align-right"> AUD ${total != null ?  total.targetValue : '0.00'}</div>
                    </div>
                </div>
                </div>
                </div>
            </body>
        </html>  
    `;
};

    function getAffiliteDetailArray(allData) {
        let getAffiliteDetailArray = []
        let orgMap = new Map();
        (allData.compParticipants || []).map((item) =>{
            (item.membershipProducts || []).map((mem) =>{
                if(isNullOrUndefined(mem.fees.membershipFee)){
                    let key = mem.fees.membershipFee.organisationId;
                    if(orgMap.get(key) == undefined ){
                        let obj = {
                            organisationId: mem.fees.membershipFee.organisationId,
                            organisationName: mem.fees.membershipFee.name,
                            organiationEmailId: mem.fees.membershipFee.emailId,
                            organiationPhoneNo: mem.fees.membershipFee.phoneNo
                        }
                        getAffiliteDetailArray.push(obj);
                        orgMap.set(key, obj);
                    }
                }
                if(isNullOrUndefined(mem.fees.affiliateFee)){
                    let key = mem.fees.affiliateFee.organisationId;
                    if(orgMap.get(key) == undefined ){
                        let obj = {
                            organisationId: mem.fees.affiliateFee.organisationId,
                            organisationName: mem.fees.affiliateFee.name,
                            organiationEmailId: mem.fees.affiliateFee.emailId,
                            organiationPhoneNo: mem.fees.affiliateFee.phoneNo
                        }
                        getAffiliteDetailArray.push(obj);
                        orgMap.set(key, obj);
                    }
                }
                if(isNullOrUndefined(mem.fees.competitionOrganisorFee)){
                    let key = mem.fees.competitionOrganisorFee.organisationId;
                    if(orgMap.get(key) == undefined ){
                        let obj = {
                            organisationId: mem.fees.competitionOrganisorFee.organisationId,
                            organisationName: mem.fees.competitionOrganisorFee.name,
                            organiationEmailId: mem.fees.competitionOrganisorFee.emailId,
                            organiationPhoneNo: mem.fees.competitionOrganisorFee.phoneNo
                        }
                        getAffiliteDetailArray.push(obj);
                        orgMap.set(key, obj);
                    }
                }
            });
        });
        return getAffiliteDetailArray
    }

export default getTeamRegistrationInvoiceTemplate;