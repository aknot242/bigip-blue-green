import re
from locust import HttpLocust, TaskSet, task

class WebsiteTasks(TaskSet):

    @task
    def index(self):
        HOME_PAGE_TITLE_REGEX = re.compile(r"You are on node 1") # regex for contents of blue pool member response
        with self.client.get("/", verify=False, catch_response=True) as response:
            if HOME_PAGE_TITLE_REGEX.search(response.text) == None:
                response.failure("not node 1") # a failure indicates that the response is likely from a green node

class WebsiteUser(HttpLocust):
    task_set = WebsiteTasks
    min_wait = 5000
    max_wait = 15000
