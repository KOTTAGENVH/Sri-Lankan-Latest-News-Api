/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable } from '@nestjs/common';
import { CreateLatestNewDto } from './dto/create-latest-new.dto';
import { UpdateLatestNewDto } from './dto/update-latest-new.dto';
import * as cheerio from 'cheerio';
import axios from 'axios';

@Injectable()
export class LatestNewsService {
  async latestLankadeepa(page: number) {
    try {
      const response = await axios.get(
        `https://www.lankadeepa.lk/latest_news/${page}`,
      );

      const html = response.data; // Get HTML content from Axios response
      const $ = cheerio.load(html); // Load HTML content into cheerio

      // Find the <section> tag with class 'bg0 p-t-10 p-b-0'
      const latestSection = $('section.bg0.p-t-10.p-b-0');

      // Check if the section is found
      if (latestSection.length > 0) {
        // Find the div with class 'flex-wr-sb-s p-t-20 p-b-15 how-bor2 row' within the section
        const postDiv = latestSection.find(
          'div.flex-wr-sb-s.p-t-20.p-b-15.how-bor2.row',
        );

        // Extract the href attributes from the links within the div
        const links = postDiv
          .find('a')
          .map((_, element) => $(element).attr('href'))
          .get();

        // Extract the HTML content from the div
        const htmlContents = postDiv
          .find('.col-7')
          .map((_, element) => $(element).html())
          .get();

        // Initialize an empty array to store the results
        const result = [];

        // Loop through each HTML content
        htmlContents.forEach((htmlContent, index) => {
          const $content = cheerio.load(htmlContent); // Load HTML content into cheerio

          // Extract topic
          const topic = $content('h5').first().text().trim();

          // Extract description
          const description = $content('h5').last().text().trim();

          // Push the result to the array
          result.push({
            source: links[index],
            topic: topic,
            description: description,
          });
        });

        return result;
      } else {
        return 'Section with class "bg0 p-t-10 p-b-0" not found';
      }
    } catch (error) {
      // Handle errors if the request fails
      console.error('Error fetching data:', error);
      return 'Error fetching data';
    }
  }

  async latestDeshaya(page: number) {
    try {
      const response = await axios.get(
        `https://www.deshaya.lk/43/features/${page}`,
      );
      const html = response.data;
      const $ = cheerio.load(html);

      // Arrays to store extracted data
      const titles = [];
      const sources = [];
      const descriptions = [];

      // Extract data from elements with class sec-1-ite-tit
      $('.sec-1-ite-tit').each((index, element) => {
        // Push text of anchor tags into titles array
        titles.push($(element).find('a').text().trim());
        // Push href of anchor tags into sources array
        sources.push($(element).find('a').attr('href').trim());
      });

      // Extract data from elements with class sec-1-ite-tex
      $('.sec-1-ite-tex').each((index, element) => {
        // Push text of elements into descriptions array
        descriptions.push($(element).text().trim());
      });

      // Check if the lengths of all arrays are equal
      if (
        titles.length === sources.length &&
        titles.length === descriptions.length
      ) {
        // Combine arrays into an array of objects
        const result = titles.map((title, index) => ({
          title,
          description: descriptions[index],
          source: sources[index],
        }));
        return result;
      } else {
        throw new Error(
          'Data extraction error: lengths of arrays are not equal',
        );
      }
    } catch (error) {
      console.error('Error:', error);
      throw error; // Propagate error up
    }
  }
}
