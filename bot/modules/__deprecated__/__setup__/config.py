############### OLD CONFIG FILE - FOR REFERENCE FOR DEVELOPERS - DO NOT USE #################


###################################################### CONFIGURE YOUR TOOLS HERE ######################################################

# >>>>>>>>>>> Global Settings <<<<<<<<<<<

# Directory and name of the files where history of applied jobs is saved (Sentence after the last "/" will be considered as the file name).
file_name = "all excels/all_applied_applications_history.csv"
failed_file_name = "all excels/all_failed_applications_history.csv"
logs_folder_path = "logs/"

# Set the maximum amount of time allowed to wait between each click in secs
# Enter max allowed secs to wait approximately. (Only Non Negative Integers Eg: 0,1,2,3,....)
click_gap = 2

# If you want to see Chrome running then set run_in_background as False (May reduce performance).
# True or False, Note: True or False are case-sensitive ,   If True, this will make pause_at_failed_question, pause_before_submit and run_in_background as False
run_in_background = False

# If you want to disable extensions then set disable_extensions as True (Better for performance)
# True or False, Note: True or False are case-sensitive
disable_extensions = True

# Run in safe mode. Set this true if chrome is taking too long to open or if you have multiple profiles in browser. This will open chrome in guest profile!
# True or False, Note: True or False are case-sensitive
safe_mode = False

# Do you want scrolling to be smooth or instantaneous? (Can reduce performance if True)
# True or False, Note: True or False are case-sensitive
smooth_scroll = False

# If enabled (True), the program would keep your screen active and prevent PC from sleeping. Instead you could disable this feature (set it to false) and adjust your PC sleep settings to Never Sleep or a preferred time.
# True or False, Note: True or False are case-sensitive (Note: Will temporarily deactivate when any application dialog boxes are present (Eg: Pause before submit, Help needed for a question..))
keep_screen_awake = True

# Run in undetected mode to bypass anti-bot protections (Preview Feature, UNSTABLE. Recommended to leave it as False)
# True or False, Note: True or False are case-sensitive
undetected_mode = True
# Now called as stealth_mode

# Use ChatGPT for resume building (Experimental Feature can break the application. Recommended to leave it as False)
use_resume_generator = False       # True or False, Note: True or False are case-sensitive ,   This feature may only work with 'undetected_mode' = True. As ChatGPT website is hosted by CloudFlare which is protected by Anti-bot protections!


# ----------------------------------------------  AUTO APPLIER  ---------------------------------------------- #

# Login Credentials for LinkedIn
username = "username@example.com"  # Enter your username in the quotes
password = "example_password"      # Enter your password in the quotes

# These Sentences are Searched in LinkedIn
# Enter your search terms inside '[ ]' with quotes ' "searching title" ' for each search followed by comma ', ' Eg: ["Software Engineer", "Software Developer", "Selenium Developer"]
search_terms = ["Software Engineer", "Software Developer", "Python Developer", "Selenium Developer", "React Developer",
                "Java Developer", "Front End Developer", "Full Stack Developer", "Web Developer", "Nodejs Developer"]

# Search location, this will be filled in "City, state, or zip code" search box. If left empty as "", tool will not fill it.
# Some valid examples: "", "United States", "India", "Chicago, Illinois, United States", "90001, Los Angeles, California, United States", "Bengaluru, Karnataka, India", etc.
search_location = ""


# >>>>>>>>>>> Job Search Filters <<<<<<<<<<<
''' 
You could set your preferences or leave them as empty to not select options except for 'True or False' options. Below are some valid examples for leaving them empty:

question_1 = ""                    # answer1, answer2, answer3, etc.
question_2 = []                    # (multiple select)
question_3 = []                    # (dynamic multiple select)

'''

# "Most recent", "Most relevant" or ("" to not select)
sort_by = ""
# "Any time", "Past month", "Past week", "Past 24 hours" or ("" to not select)
date_posted = "Past month"
# "$40,000+", "$60,000+", "$80,000+", "$100,000+", "$120,000+", "$140,000+", "$160,000+", "$180,000+", "$200,000+"
salary = ""

# True or False, Note: True or False are case-sensitive
easy_apply_only = True

# (multiple select) "Internship", "Entry level", "Associate", "Mid-Senior level", "Director", "Executive"
experience_level = []
# (multiple select) "Full-time", "Part-time", "Contract", "Temporary", "Volunteer", "Internship", "Other"
job_type = []
# (multiple select) "On-site", "Remote", "Hybrid"
on_site = []

# (dynamic multiple select) make sure the name you type in list exactly matches with the company name you're looking for, including capitals.
companies = []
# Eg: "7-eleven", "Google","X, the moonshot factory","YouTube","CapitalG","Adometry (acquired by Google)","Meta","Apple","Byte Dance","Netflix", "Snowflake","Mineral.ai","Microsoft","JP Morgan","Barclays","Visa","American Express", "Snap Inc", "JPMorgan Chase & Co.", "Tata Consultancy Services", "Recruiting from Scratch", "Epic", and so on...
location = []                      # (dynamic multiple select)
industry = []                      # (dynamic multiple select)
job_function = []                  # (dynamic multiple select)
job_titles = []                    # (dynamic multiple select)
benefits = []                      # (dynamic multiple select)
commitments = []                   # (dynamic multiple select)

# True or False, Note: True or False are case-sensitive
under_10_applicants = False
# True or False, Note: True or False are case-sensitive
in_your_network = False
# True or False, Note: True or False are case-sensitive
fair_chance_employer = False


# >>>>>>>>>>> Easy Apply Questions & Inputs <<<<<<<<<<<

# Phone number (required), make sure it's valid.
# Enter your 10 digit number in quotes Eg: "9876543210"
phone_number = "9876543210"

# Give an relative or absolute path of your default resume to be uploaded. If file in not found, will continue using your previously uploaded resume in LinkedIn.
default_resume_path = "all resumes/default/resume.pdf"      # (In Development)

# What do you want to answer for questions that ask about years of experience you have, this is different from current_experience?
# A number in quotes Eg: "0","1","2","3","4", etc.
years_of_experience = "5"

# Do you need visa sponsorship now or in future?
require_visa = "No"               # "Yes" or "No"

# What is the status of your citizenship? # If left empty as "", tool will not answer the question. However, note that some companies make it compulsory to be answered
# Valid options are: "U.S. Citizen/Permanent Resident", "Non-citizen allowed to work for any employer", "Non-citizen allowed to work for current employer", "Non-citizen seeking work authorization", "Canadian Citizen/Permanent Resident" or "Other"
us_citizenship = "U.S. Citizen/Permanent Resident"


# What is the link to your portfolio website, leave it empty as "", if you want to leave this question unanswered
# "www.example.bio" or "" and so on....
website = ""

# What to enter in your desired salary question, only enter in numbers inside quotes as some companies only allow numbers
# "80000", "90000", "100000" or "120000" and so on....
desired_salary = "120000"

# Example question: "On a scale of 1-10 how much experience do you have building web or mobile applications? 1 being very little or only in school, 10 being that you have built and launched applications to real users"
# Any number between "1" to "10" including 1 and 10, put it in quotes ""
confidence_level = "8"

# If left empty will fill in location of jobs location.
current_city = ""

## SOME ANNOYING QUESTIONS BY COMPANIES 🫠 ##
# Address, not so common question but some job applications make it required!
street = "123 Main Street"
state = "STATE"
zipcode = "12345"
country = "Will Let You Know When Established"

first_name = "Sai"                 # Your first name in quotes Eg: "First", "Sai"
middle_name = "Vignesh"            # Your name in quotes Eg: "Middle", "Vignesh", ""
last_name = "Golla"                # Your last name in quotes Eg: "Last", "Golla"

# Your LinkedIn headline in quotes Eg: "Software Engineer @ Google, Masters in Computer Science", "Recent Grad Student @ MIT, Computer Science"
headline = "Headline"

# Your summary in quotes, use \n to add line breaks
summary = "Summary"

# Your cover letter in quotes, use \n to add line breaks
cover_letter = "Cover Letter"

# Name of your most recent employer
# "", "Lala Company", "Google", "Snowflake", "Databricks"
recent_employer = "Not Applicable"

# US Equal Opportunity questions
# What is your ethnicity or race? If left empty as "", tool will not answer the question. However, note that some companies make it compulsory to be answered
ethnicity = "Decline"              # "Decline", "Hispanic/Latino", "American Indian or Alaska Native", "Asian", "Black or African American", "Native Hawaiian or Other Pacific Islander", "White", "Other"

# How do you identify yourself? If left empty as "", tool will not answer the question. However, note that some companies make compulsory to be answered
gender = "Decline"                 # "Male", "Female", "Other", "Decline" or ""

# Are you physically disabled or have a history/record of having a disability? If left empty as "", tool will not answer the question. However, note that some companies make it compulsory to be answered
disability_status = "Decline"      # "Yes", "No", "Decline"

veteran_status = "Decline"         # "Yes", "No", "Decline"
##


# >>>>>>>>>>> LinkedIn Settings <<<<<<<<<<<

# Do you want to randomize the search order for search_terms?
randomize_search_order = False     # True of False

# Do you want to overwrite previous answers?
# True or False, Note: True or False are case-sensitive
overwrite_previous_answers = False


# Skip irrelevant jobs
# Avoid applying to these companies, and companies with these bad words in their 'About Company' section...
# (dynamic multiple search) or leave empty as []. Ex: ["Staffing", "Recruiting", "Name of Company you don't want to apply to"]
about_company_bad_words = ["Crossover", "Staffing", "Recruiting", "Jobot"]

# Skip checking for `about_company_bad_words` for these companies if they have these good words in their 'About Company' section... [Exceptions, For example, I want to apply to "Robert Half" although it's a staffing company]
# (dynamic multiple search) or leave empty as []. Ex: ["Robert Half", "Dice"]
about_company_good_words = []


# Avoid applying to these companies if they have these bad words in their 'Job Description' section...  (In development)
# (dynamic multiple search) or leave empty as []. Case Insensitive. Ex: ["word_1", "phrase 1", "word word", "polygraph", "US Citizenship", "Security Clearance"]
bad_words = ["US Citizen", "USA Citizen", "No C2C",
             "No Corp2Corp", ".NET", "Embedded Programming", "PHP", "Ruby"]

# Do you have an active Security Clearance? (True for Yes and False for No)
# True or False, Note: True or False are case-sensitive
security_clearance = False

# Do you have a Masters degree? (True for Yes and False for No). If True, the tool will apply to jobs containing the word 'master' in their job description and if it's experience required <= current_experience + 2 and current_experience is not set as -1.
# True or False, Note: True or False are case-sensitive
did_masters = True

# Avoid applying to jobs if their required experience is above your current_experience. (Set value as -1 if you want to apply to all ignoring their required experience...)
current_experience = 5             # Integers > -2 (Ex: -1, 0, 1, 2, 3, 4...)
##


# Allow Manual Inputs
# Should the tool pause before every submit application during easy apply to let you check the information?
# True or False, Note: True or False are case-sensitive
pause_before_submit = True
'''
Note: Will be treated as False if `run_in_background = True`
'''

# Should the tool pause if it needs help in answering questions during easy apply?
# Note: If set as False will answer randomly...
# True or False, Note: True or False are case-sensitive
pause_at_failed_question = True
'''
Note: Will be treated as False if `run_in_background = True`
'''
##

# Keep the External Application tabs open? (Note: RECOMMENDED TO LEAVE IT AS TRUE, if you set it false, be sure to CLOSE ALL TABS BEFORE CLOSING THE BROWSER!!!)
# True or False, Note: True or False are case-sensitive
close_tabs = True

# After how many number of applications in current search should the bot switch to next search?
switch_number = 30                 # Only numbers greater than 0... Don't put in quotes

# Upcoming features (In Development)
# Send connection requests to HR's
# True or False, Note: True or False are case-sensitive
connect_hr = True

# What message do you want to send during connection request? (Max. 200 Characters)
# Leave Empty to send connection request without personalized invitation (recommended to leave it empty, since you only get 10 per month without LinkedIn Premium*)
connect_request_message = ""

# Do you want the program to run continuously until you stop it? (Beta)
# True or False, Note: True or False are case-sensitive
run_non_stop = False
'''
Note: Will be treated as False if `run_in_background = True`
'''
alternate_sortby = True            # True or False, Note: True or False are case-sensitive
# True or False, Note: True or False are case-sensitive
cycle_date_posted = True
# True or False, Note: True or False are case-sensitive
stop_date_cycle_at_24hr = True
##


# ----------------------------------------------  RESUME GENERATOR (Experimental & In Development)  ---------------------------------------------- #

# Login Credentials for ChatGPT
chatGPT_username = "username@example.com"
chatGPT_password = "example_password"

chatGPT_resume_chat_title = "Resume review and feedback."

# Give the path to the folder where all the generated resumes are to be stored
generated_resume_path = "all resumes/"
