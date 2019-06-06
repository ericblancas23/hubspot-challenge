'use strict';

const got = require('got');
const moment = require('moment');
const util = require('util');
const dedupe = require('dedupe');

got('https://candidate.hubteam.com/candidateTest/v3/problem/dataset?userKey=43adbb9a79d336cae5ab9149ee6f').then((response) => {
    let availabilityMap = {};
    let availabilities = {};
    let combinedAvailabilities = {};
    let invitation = {
        countries: []
    };

    const data = JSON.parse(response.body)
    const partners = data.partners;

    partners.forEach((partner) => {
        const availableDates = partner.availableDates;
        const country = partner.country;
        const email = partner.email;
        let filteredAvailableDates;

        if (!availabilityMap[country]) {
            availabilityMap[country] = {};
            availabilities[country] = [];
            combinedAvailabilities[country] = [];
        }

        // filter dates to ones that is one day apart
        filteredAvailableDates = availableDates.filter((date, index, array) => {
            return moment(date).diff(moment(array[index - 1]), 'days') === 1 || moment(date).diff(moment(array[index + 1]), 'days') === -1
        })

        filteredAvailableDates.forEach((availableDate, index) => {
            if (availabilityMap[country][availableDate]) {
                availabilityMap[country][availableDate].attendees.push(email);
            } else {
                availabilityMap[country][availableDate] = {
                    attendees: [email]
                };
            }
        });
    });

    // restructure data for sorting
    for (let country in availabilityMap) {
        if (availabilityMap.hasOwnProperty(country)) {
            for (let date in availabilityMap[country]) {
                availabilities[country].push({
                    date: date,
                    attendees: availabilityMap[country][date].attendees
                });
            }
        }
    }

    // sort on dates
    for (let country in availabilities) {
        if (availabilities.hasOwnProperty(country)) {
            availabilities[country].sort((current, next) => {
                if (moment(current.date).isBefore(moment(next.date))) {
                    return -1;
                } else {
                    return 1;
                }
            });
        }
    }

    // combined count for two-day event
    for (let country in availabilities) {
        if (availabilities.hasOwnProperty(country)) {
            for (let i = 0; i < availabilities[country].length; i++) {
                if (i !== 0) {
                    combinedAvailabilities[country].push({
                        dates: [
                            availabilities[country][i - 1].date,
                            availabilities[country][i].date
                        ],
                        attendeeCount: dedupe(keepDuplicates(availabilities[country][i - 1].attendees.concat(availabilities[country][i].attendees))).length,
                        attendees: dedupe(keepDuplicates(availabilities[country][i - 1].attendees.concat(availabilities[country][i].attendees)))
                    });
                }
            }
        }
    }

    // sort on counts
    for (let country in combinedAvailabilities) {
        if (combinedAvailabilities.hasOwnProperty(country)) {
           combinedAvailabilities[country].sort((current, next) => {
             if(current.attendeeCount > next.attendeeCount) {
                 return -1;
             } else if(current.attendeeCount < next.attendeeCount) {
                 return 1;
             } else {
                 if(moment(current.dates[0]).isBefore(moment(next.dates[0]))) {
                    return -1;
                 } else {
                    return 1;
                 }
             }
           });
        }
    }

    // map data into required shape
    for (let country in combinedAvailabilities) {
        if (combinedAvailabilities.hasOwnProperty(country)) {
           invitation['countries'].push({
               attendeeCount: combinedAvailabilities[country][0].attendeeCount,
               attendees: combinedAvailabilities[country][0].attendees,
               name: country,
               startDate: combinedAvailabilities[country][0].dates[0] ? combinedAvailabilities[country][0].dates[0] : null
           });
        }
    }

    // post = profit
    got.post('https://candidate.hubteam.com/candidateTest/v3/problem/result?userKey=43adbb9a79d336cae5ab9149ee6f', {
        body: JSON.stringify(invitation),
        headers: {
            'Content-type': 'application/json'
        }
    }).then((response) => {
        console.log(response.body);
    }).catch((error) => {
        console.error(error);
    });;
}).catch((error) => {
    console.error(error);
});

// This is to keep the duplicated attendees, because they are the only ones can attend on both days
function keepDuplicates(array) {
    let result = [];

    for(let i = 0; i < array.length; i++) {
        let temp = array.slice();
        temp.splice(i, 1);
        if(temp.indexOf(array[i]) > -1) {
            result.push(array[i]);
        }
    }
    return result;
}
