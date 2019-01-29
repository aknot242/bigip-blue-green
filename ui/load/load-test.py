import re
from locust import HttpLocust, TaskSet, task
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


def index(l):
    HOME_PAGE_TITLE_REGEX = re.compile(r"You are on node 1")
    with l.client.get("/", verify=False, catch_response=True) as response:
        if HOME_PAGE_TITLE_REGEX.search(response.content) == None:
            response.failure("not node 1")


class UserBehavior(TaskSet):
    tasks = {index: 2}


class WebsiteUser(HttpLocust):
    task_set = UserBehavior
    host = "https://demo.f5.com"
    min_wait = 5000
    max_wait = 9000
